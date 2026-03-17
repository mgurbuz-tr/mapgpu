import { describe, it, expect } from 'vitest';
import { SceneGraph, SceneNode } from './SceneGraph.js';

describe('SceneGraph', () => {
  // ─── Construction ───

  it('should create with root node', () => {
    const graph = new SceneGraph();
    expect(graph.root).toBeDefined();
    expect(graph.root.type).toBe('root');
    expect(graph.root.id).toBe('__root__');
    expect(graph.nodeCount).toBe(1); // root only
  });

  // ─── addNode ───

  it('should add node to root', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, { id: 'layer-group', type: 'layer-group' });
    expect(node).not.toBeNull();
    expect(node!.id).toBe('layer-group');
    expect(node!.type).toBe('layer-group');
    expect(node!.parent).toBe(graph.root);
    expect(graph.root.children.length).toBe(1);
    expect(graph.nodeCount).toBe(2);
  });

  it('should add node to specific parent', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'group', type: 'layer-group' });
    const child = graph.addNode('group', { id: 'layer1', type: 'layer' });
    expect(child).not.toBeNull();
    expect(child!.parent!.id).toBe('group');
    expect(graph.nodeCount).toBe(3);
  });

  it('should prevent duplicate ids', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer' });
    const dup = graph.addNode(null, { id: 'a', type: 'batch' });
    expect(dup).toBeNull();
    expect(graph.nodeCount).toBe(2); // root + 'a'
  });

  it('should return null when parent not found', () => {
    const graph = new SceneGraph();
    const node = graph.addNode('nonexistent', { id: 'x', type: 'layer' });
    expect(node).toBeNull();
  });

  it('should add node with transform', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, {
      id: 'positioned',
      type: 'layer',
      transform: {
        position: [100, 200, 300],
        scale: [2, 2, 2],
      },
    });
    expect(node!.transform.position).toEqual([100, 200, 300]);
    expect(node!.transform.scale).toEqual([2, 2, 2]);
    expect(node!.transform.rotation).toEqual([0, 0, 0, 1]); // default
  });

  it('should add node with visibility', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, {
      id: 'hidden',
      type: 'layer',
      visible: false,
    });
    expect(node!.visible).toBe(false);
  });

  it('should add node with data', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, {
      id: 'dataNode',
      type: 'layer',
      data: { layerId: 'wms-1', opacity: 0.5 },
    });
    expect(node!.data).toEqual({ layerId: 'wms-1', opacity: 0.5 });
  });

  // ─── removeNode ───

  it('should remove node', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer' });
    expect(graph.nodeCount).toBe(2);

    const removed = graph.removeNode('a');
    expect(removed).toBe(true);
    expect(graph.nodeCount).toBe(1);
    expect(graph.findNode('a')).toBeUndefined();
  });

  it('should remove node and all descendants', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'group', type: 'layer-group' });
    graph.addNode('group', { id: 'child1', type: 'layer' });
    graph.addNode('group', { id: 'child2', type: 'layer' });
    graph.addNode('child1', { id: 'grandchild', type: 'batch' });
    expect(graph.nodeCount).toBe(5); // root + group + 2 children + grandchild

    const removed = graph.removeNode('group');
    expect(removed).toBe(true);
    expect(graph.nodeCount).toBe(1); // only root
    expect(graph.findNode('group')).toBeUndefined();
    expect(graph.findNode('child1')).toBeUndefined();
    expect(graph.findNode('child2')).toBeUndefined();
    expect(graph.findNode('grandchild')).toBeUndefined();
  });

  it('should not remove root', () => {
    const graph = new SceneGraph();
    const removed = graph.removeNode('__root__');
    expect(removed).toBe(false);
    expect(graph.nodeCount).toBe(1);
  });

  it('should return false for non-existent node', () => {
    const graph = new SceneGraph();
    const removed = graph.removeNode('nonexistent');
    expect(removed).toBe(false);
  });

  it('remove should detach from parent children list', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer' });
    graph.addNode(null, { id: 'b', type: 'layer' });
    expect(graph.root.children.length).toBe(2);

    graph.removeNode('a');
    expect(graph.root.children.length).toBe(1);
    expect(graph.root.children[0].id).toBe('b');
  });

  // ─── findNode ───

  it('should find node by id', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'target', type: 'layer' });
    const found = graph.findNode('target');
    expect(found).toBeDefined();
    expect(found!.id).toBe('target');
  });

  it('should return undefined for non-existent node', () => {
    const graph = new SceneGraph();
    expect(graph.findNode('nope')).toBeUndefined();
  });

  // ─── traverse ───

  it('should traverse all nodes DFS', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer-group' });
    graph.addNode('a', { id: 'b', type: 'layer' });
    graph.addNode('a', { id: 'c', type: 'layer' });
    graph.addNode(null, { id: 'd', type: 'terrain' });

    const visited: string[] = [];
    graph.traverse((node) => {
      visited.push(node.id);
    });

    // DFS order: root, a, b, c, d
    expect(visited).toEqual(['__root__', 'a', 'b', 'c', 'd']);
  });

  it('traverse should skip children when callback returns false', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer-group' });
    graph.addNode('a', { id: 'b', type: 'layer' });
    graph.addNode('a', { id: 'c', type: 'layer' });
    graph.addNode(null, { id: 'd', type: 'terrain' });

    const visited: string[] = [];
    graph.traverse((node) => {
      visited.push(node.id);
      if (node.id === 'a') return false; // skip children of 'a'
    });

    expect(visited).toEqual(['__root__', 'a', 'd']);
  });

  it('traverse from specific start node', () => {
    const graph = new SceneGraph();
    const groupNode = graph.addNode(null, { id: 'group', type: 'layer-group' })!;
    graph.addNode('group', { id: 'child1', type: 'layer' });
    graph.addNode('group', { id: 'child2', type: 'layer' });
    graph.addNode(null, { id: 'other', type: 'terrain' });

    const visited: string[] = [];
    graph.traverse((node) => {
      visited.push(node.id);
    }, groupNode);

    expect(visited).toEqual(['group', 'child1', 'child2']);
  });

  // ─── getVisibleNodes ───

  it('should return all visible nodes', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer', visible: true });
    graph.addNode(null, { id: 'b', type: 'layer', visible: true });
    graph.addNode(null, { id: 'c', type: 'layer', visible: false });

    const visible = graph.getVisibleNodes();
    const ids = visible.map((n) => n.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).not.toContain('c');
  });

  it('should skip subtree of hidden parent', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'group', type: 'layer-group', visible: false });
    graph.addNode('group', { id: 'child', type: 'layer', visible: true });

    const visible = graph.getVisibleNodes();
    const ids = visible.map((n) => n.id);
    expect(ids).not.toContain('group');
    expect(ids).not.toContain('child');
  });

  it('visible nodes should not include root', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer' });
    const visible = graph.getVisibleNodes();
    const ids = visible.map((n) => n.id);
    expect(ids).not.toContain('__root__');
  });

  // ─── Dirty Tracking ───

  it('new nodes should be dirty', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, { id: 'a', type: 'layer' });
    expect(node!.dirty).toBe(true);
  });

  it('clearDirty should clear dirty flag', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, { id: 'a', type: 'layer' })!;
    node.clearDirty();
    expect(node.dirty).toBe(false);
  });

  it('setVisible should mark node dirty', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, { id: 'a', type: 'layer' })!;
    node.clearDirty();
    node.setVisible(false);
    expect(node.dirty).toBe(true);
  });

  it('setTransform should mark node dirty', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, { id: 'a', type: 'layer' })!;
    node.clearDirty();
    node.setTransform({ position: [1, 2, 3] });
    expect(node.dirty).toBe(true);
  });

  it('dirty should propagate up to parent', () => {
    const graph = new SceneGraph();
    const parent = graph.addNode(null, { id: 'parent', type: 'layer-group' })!;
    const child = graph.addNode('parent', { id: 'child', type: 'layer' })!;

    // Clear all dirty
    graph.clearAllDirty();
    expect(parent.dirty).toBe(false);
    expect(child.dirty).toBe(false);

    // Mark child dirty
    child.setVisible(false);
    expect(child.dirty).toBe(true);
    expect(parent.dirty).toBe(true);
    expect(graph.root.dirty).toBe(true);
  });

  it('dirty should propagate through multiple levels', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'level1', type: 'layer-group' });
    graph.addNode('level1', { id: 'level2', type: 'layer' });
    const leaf = graph.addNode('level2', { id: 'level3', type: 'batch' })!;

    graph.clearAllDirty();

    leaf.setTransform({ scale: [2, 2, 2] });

    expect(graph.findNode('level2')!.dirty).toBe(true);
    expect(graph.findNode('level1')!.dirty).toBe(true);
    expect(graph.root.dirty).toBe(true);
  });

  it('clearAllDirty should clear all nodes', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer' });
    graph.addNode(null, { id: 'b', type: 'layer' });

    graph.clearAllDirty();

    const dirty = graph.getDirtyNodes();
    expect(dirty.length).toBe(0);
  });

  it('getDirtyNodes should return only dirty nodes', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer' });
    const b = graph.addNode(null, { id: 'b', type: 'layer' })!;

    graph.clearAllDirty();
    b.setVisible(false);

    const dirty = graph.getDirtyNodes();
    const ids = dirty.map((n) => n.id);
    expect(ids).toContain('b');
    // 'a' was not modified, but root might be dirty from propagation
  });

  it('setVisible to same value should not mark dirty', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, { id: 'a', type: 'layer', visible: true })!;
    node.clearDirty();
    node.setVisible(true); // same value
    expect(node.dirty).toBe(false);
  });

  // ─── SceneNode: effectiveVisible ───

  it('effectiveVisible should consider ancestor visibility', () => {
    const graph = new SceneGraph();
    const parent = graph.addNode(null, { id: 'parent', type: 'layer-group', visible: true })!;
    const child = graph.addNode('parent', { id: 'child', type: 'layer', visible: true })!;

    expect(child.effectiveVisible).toBe(true);

    parent.setVisible(false);
    expect(child.effectiveVisible).toBe(false);
    expect(child.visible).toBe(true); // own visibility unchanged
  });

  // ─── SceneNode: setData ───

  it('setData should add/update metadata', () => {
    const graph = new SceneGraph();
    const node = graph.addNode(null, { id: 'a', type: 'layer' })!;
    node.setData('key1', 'value1');
    node.setData('key2', 42);
    expect(node.data).toEqual({ key1: 'value1', key2: 42 });
  });

  // ─── destroy ───

  it('destroy should clear all nodes', () => {
    const graph = new SceneGraph();
    graph.addNode(null, { id: 'a', type: 'layer' });
    graph.addNode(null, { id: 'b', type: 'layer' });
    graph.destroy();

    // After destroy, a fresh root should exist
    expect(graph.nodeCount).toBe(1);
    expect(graph.root).toBeDefined();
    expect(graph.findNode('a')).toBeUndefined();
    expect(graph.findNode('b')).toBeUndefined();
  });
});
