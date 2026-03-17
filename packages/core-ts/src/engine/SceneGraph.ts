/**
 * SceneGraph — Hiyerarsik sahne yapisi
 *
 * Scene graph modeli (docs/01-ARCHITECTURE.md §10):
 * SceneRoot → LayerGroup → LayerNode → BatchNode
 *
 * Her node: id, type, visible, children, parent, transform.
 * Dirty tracking: node degistiginde parent'a kadar dirty isaretlenir.
 * DFS traversal ve gorunur node toplama.
 */

// ─── Types ───

export type SceneNodeType =
  | 'root'
  | 'terrain'
  | 'layer-group'
  | 'layer'
  | 'batch'
  | 'annotation-group'
  | 'effect-group'
  | 'custom';

export interface SceneNodeTransform {
  /** Translation [x, y, z] */
  position: [number, number, number];
  /** Scale [sx, sy, sz] */
  scale: [number, number, number];
  /** Rotation quaternion [x, y, z, w] */
  rotation: [number, number, number, number];
}

export interface SceneNodeOptions {
  id: string;
  type: SceneNodeType;
  visible?: boolean;
  transform?: Partial<SceneNodeTransform>;
  /** Arbitrary metadata attached to the node */
  data?: Record<string, unknown>;
}

/** Callback for traverse operations */
export type TraverseCallback = (node: SceneNode) => boolean | void;

// ─── SceneNode ───

export class SceneNode {
  readonly id: string;
  readonly type: SceneNodeType;

  private _visible: boolean;
  private _dirty = true;
  private _transform: SceneNodeTransform;
  private _parent: SceneNode | null = null;
  private _children: SceneNode[] = [];
  private _data: Record<string, unknown>;

  constructor(options: SceneNodeOptions) {
    this.id = options.id;
    this.type = options.type;
    this._visible = options.visible ?? true;
    this._transform = {
      position: options.transform?.position ?? [0, 0, 0],
      scale: options.transform?.scale ?? [1, 1, 1],
      rotation: options.transform?.rotation ?? [0, 0, 0, 1],
    };
    this._data = options.data ?? {};
  }

  // ─── Getters ───

  get visible(): boolean {
    return this._visible;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  get transform(): Readonly<SceneNodeTransform> {
    return this._transform;
  }

  get parent(): SceneNode | null {
    return this._parent;
  }

  get children(): readonly SceneNode[] {
    return this._children;
  }

  get data(): Readonly<Record<string, unknown>> {
    return this._data;
  }

  /** Whether this node and all ancestors are visible */
  get effectiveVisible(): boolean {
    if (!this._visible) return false;
    if (this._parent) return this._parent.effectiveVisible;
    return true;
  }

  // ─── Setters ───

  setVisible(visible: boolean): void {
    if (this._visible === visible) return;
    this._visible = visible;
    this._markDirty();
  }

  setTransform(transform: Partial<SceneNodeTransform>): void {
    if (transform.position) {
      this._transform.position = [...transform.position];
    }
    if (transform.scale) {
      this._transform.scale = [...transform.scale];
    }
    if (transform.rotation) {
      this._transform.rotation = [...transform.rotation];
    }
    this._markDirty();
  }

  setData(key: string, value: unknown): void {
    this._data[key] = value;
  }

  // ─── Tree Operations (used by SceneGraph) ───

  /** @internal */
  _setParent(parent: SceneNode | null): void {
    this._parent = parent;
  }

  /** @internal */
  _addChild(child: SceneNode): void {
    this._children.push(child);
  }

  /** @internal */
  _removeChild(childId: string): SceneNode | undefined {
    const idx = this._children.findIndex((c) => c.id === childId);
    if (idx === -1) return undefined;
    const [removed] = this._children.splice(idx, 1);
    return removed;
  }

  // ─── Dirty Tracking ───

  clearDirty(): void {
    this._dirty = false;
  }

  private _markDirty(): void {
    this._dirty = true;
    // Propagate dirty up to root
    if (this._parent) {
      this._parent._markDirtyFromChild();
    }
  }

  /** @internal — called by child nodes */
  _markDirtyFromChild(): void {
    if (this._dirty) return; // already dirty, no need to propagate further
    this._dirty = true;
    if (this._parent) {
      this._parent._markDirtyFromChild();
    }
  }
}

// ─── SceneGraph ───

export class SceneGraph {
  private _root: SceneNode;
  private _nodeMap = new Map<string, SceneNode>();

  constructor() {
    this._root = new SceneNode({ id: '__root__', type: 'root' });
    this._nodeMap.set(this._root.id, this._root);
  }

  /** The root node of the scene graph */
  get root(): SceneNode {
    return this._root;
  }

  /** Total number of nodes (including root) */
  get nodeCount(): number {
    return this._nodeMap.size;
  }

  // ─── Node Operations ───

  /**
   * Add a node as a child of the given parent.
   * If parentId is null, adds to root.
   * Returns the added node, or null if parent not found or duplicate id.
   */
  addNode(parentId: string | null, options: SceneNodeOptions): SceneNode | null {
    // Prevent duplicate ids
    if (this._nodeMap.has(options.id)) return null;

    const parent = parentId ? this._nodeMap.get(parentId) : this._root;
    if (!parent) return null;

    const node = new SceneNode(options);
    node._setParent(parent);
    parent._addChild(node);
    this._nodeMap.set(node.id, node);

    return node;
  }

  /**
   * Remove a node and all its descendants from the graph.
   * Cannot remove root.
   * Returns true if the node was found and removed.
   */
  removeNode(id: string): boolean {
    if (id === this._root.id) return false;

    const node = this._nodeMap.get(id);
    if (!node) return false;

    // Remove all descendants first
    this._removeDescendants(node);

    // Detach from parent
    const parent = node.parent;
    if (parent) {
      parent._removeChild(id);
    }
    node._setParent(null);
    this._nodeMap.delete(id);

    // Mark parent dirty
    if (parent) {
      parent._markDirtyFromChild();
    }

    return true;
  }

  /**
   * Find a node by its id.
   */
  findNode(id: string): SceneNode | undefined {
    return this._nodeMap.get(id);
  }

  // ─── Traversal ───

  /**
   * Depth-first traversal of the scene graph.
   * Callback receives each node. Return false from callback to skip children.
   */
  traverse(callback: TraverseCallback, startNode?: SceneNode): void {
    const start = startNode ?? this._root;
    this._dfs(start, callback);
  }

  /**
   * Collect all visible nodes (nodes where effectiveVisible is true).
   * Does not include the root node.
   */
  getVisibleNodes(): SceneNode[] {
    const result: SceneNode[] = [];
    this.traverse((node) => {
      if (node === this._root) return; // skip root
      if (!node.visible) return false; // skip subtree if node is hidden
      result.push(node);
    });
    return result;
  }

  /**
   * Collect all dirty nodes.
   */
  getDirtyNodes(): SceneNode[] {
    const result: SceneNode[] = [];
    this.traverse((node) => {
      if (node.dirty && node !== this._root) {
        result.push(node);
      }
    });
    return result;
  }

  /**
   * Clear dirty flags on all nodes.
   */
  clearAllDirty(): void {
    this.traverse((node) => {
      node.clearDirty();
    });
  }

  // ─── Lifecycle ───

  destroy(): void {
    this._nodeMap.clear();
    // Re-create a fresh root (so the graph is usable if somehow referenced after destroy)
    this._root = new SceneNode({ id: '__root__', type: 'root' });
    this._nodeMap.set(this._root.id, this._root);
  }

  // ─── Private ───

  private _dfs(node: SceneNode, callback: TraverseCallback): void {
    const shouldContinue = callback(node);
    if (shouldContinue === false) return;
    for (const child of node.children) {
      this._dfs(child, callback);
    }
  }

  private _removeDescendants(node: SceneNode): void {
    for (const child of [...node.children]) {
      this._removeDescendants(child);
      this._nodeMap.delete(child.id);
    }
  }
}
