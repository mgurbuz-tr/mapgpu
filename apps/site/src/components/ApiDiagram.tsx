import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  packages,
  classes,
  edges as graphEdges,
  type ClassDef,
} from '../data/api-graph';

// Logical package groups for the filter bar (maps display name → split pkg IDs)
const filterGroups: { label: string; color: string; ids: string[] }[] = [
  { label: 'core',          color: '#ff6d3a', ids: ['core-engine', 'core-mgr'] },
  { label: 'render-webgpu', color: '#f47067', ids: ['render'] },
  { label: 'adapters-ogc',  color: '#79c0ff', ids: ['adapters'] },
  { label: 'layers',        color: '#58a6ff', ids: ['layers-base', 'layers-feat'] },
  { label: 'widgets',       color: '#3fb950', ids: ['widgets'] },
  { label: 'tools',         color: '#bc8cff', ids: ['tools'] },
  { label: 'analysis',      color: '#d29922', ids: ['analysis'] },
  { label: 'terrain',       color: '#56d364', ids: ['terrain'] },
];

/* ------------------------------------------------------------------ */
/*  Layout constants                                                   */
/* ------------------------------------------------------------------ */

const NODE_W = 240;
const METHOD_H = 20;
const HEADER_H = 32;
const BOTTOM_PAD = 8;
const NODE_GAP = 14;
const COL_W = 320;
const ROW_GAP = 60;
const PKG_PAD_X = 16;
const PKG_PAD_TOP = 44;
const PKG_PAD_BOTTOM = 16;

function nodeHeight(cls: ClassDef): number {
  const lines = Math.max(cls.methods.length, 1);
  return HEADER_H + lines * METHOD_H + BOTTOM_PAD;
}

/* ------------------------------------------------------------------ */
/*  Build graph elements                                               */
/* ------------------------------------------------------------------ */

function buildGraph(activePackages: Set<string>) {
  // Group classes by package
  const grouped = new Map<string, ClassDef[]>();
  for (const cls of classes) {
    if (!activePackages.has(cls.pkg)) continue;
    const list = grouped.get(cls.pkg) ?? [];
    list.push(cls);
    grouped.set(cls.pkg, list);
  }

  // Calculate package block heights
  const pkgHeights = new Map<string, number>();
  for (const [pkg, clss] of grouped) {
    const totalH = clss.reduce((s, c) => s + nodeHeight(c) + NODE_GAP, 0) - NODE_GAP;
    pkgHeights.set(pkg, PKG_PAD_TOP + totalH + PKG_PAD_BOTTOM);
  }

  // Row heights (max in each row)
  const rowMax = new Map<number, number>();
  for (const [pkg, def] of Object.entries(packages)) {
    if (!activePackages.has(pkg)) continue;
    const h = pkgHeights.get(pkg) ?? 0;
    rowMax.set(def.row, Math.max(rowMax.get(def.row) ?? 0, h));
  }

  // Cumulative row Y
  const rowY = new Map<number, number>();
  let cumY = 0;
  for (const row of [...rowMax.keys()].sort((a, b) => a - b)) {
    rowY.set(row, cumY);
    cumY += (rowMax.get(row) ?? 0) + ROW_GAP;
  }

  const nodes: Node[] = [];

  // Package group nodes
  for (const [pkgId, pkg] of Object.entries(packages)) {
    if (!activePackages.has(pkgId)) continue;
    const h = pkgHeights.get(pkgId) ?? 200;
    nodes.push({
      id: `pkg-${pkgId}`,
      type: 'packageGroup',
      data: { label: pkg.label, color: pkg.color, description: pkg.description },
      position: { x: pkg.col * COL_W, y: rowY.get(pkg.row) ?? 0 },
      style: { width: NODE_W + PKG_PAD_X * 2, height: h },
      selectable: false,
      draggable: false,
    });
  }

  // Class nodes (relative to parent group)
  for (const [pkgId, clss] of grouped) {
    let y = PKG_PAD_TOP;
    for (const cls of clss) {
      nodes.push({
        id: cls.id,
        type: 'classNode',
        parentId: `pkg-${pkgId}`,
        data: {
          label: cls.id,
          pkg: cls.pkg,
          isAbstract: cls.type === 'abstract',
          methods: cls.methods,
          props: cls.props ?? [],
          parentClass: cls.parent,
          color: packages[pkgId].color,
        },
        position: { x: PKG_PAD_X, y },
        style: { width: NODE_W },
      });
      y += nodeHeight(cls) + NODE_GAP;
    }
  }

  // Edges
  const activeClassIds = new Set(classes.filter(c => activePackages.has(c.pkg)).map(c => c.id));
  const edgeList: Edge[] = graphEdges
    .filter(e => activeClassIds.has(e.source) && activeClassIds.has(e.target))
    .map((e, i) => {
      const isExtends = e.type === 'extends';
      const srcCls = classes.find(c => c.id === e.source);
      const color = isExtends
        ? (packages[srcCls?.pkg ?? '']?.color ?? '#8b949e')
        : '#8b949e';
      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        type: isExtends ? 'smoothstep' : 'default',
        animated: isExtends,
        style: {
          stroke: color,
          strokeWidth: isExtends ? 2 : 1,
          strokeDasharray: isExtends ? undefined : '6 3',
          opacity: isExtends ? 0.8 : 0.4,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 16,
          height: 16,
        },
      };
    });

  return { nodes, edges: edgeList };
}

/* ------------------------------------------------------------------ */
/*  Custom node: Package group                                         */
/* ------------------------------------------------------------------ */

function PackageGroupNode({ data }: NodeProps) {
  return (
    <div
      className="pkg-group-node"
      style={{
        borderColor: `${data.color as string}40`,
        backgroundColor: `${data.color as string}08`,
      }}
    >
      <div className="pkg-group-header">
        <span className="pkg-dot" style={{ backgroundColor: data.color as string }} />
        <span className="pkg-name" style={{ color: data.color as string }}>
          {data.label as string}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom node: Class                                                 */
/* ------------------------------------------------------------------ */

function ClassNodeComponent({ data, selected }: NodeProps) {
  const color = data.color as string;
  return (
    <div
      className={`class-node ${selected ? 'selected' : ''} ${data.isAbstract ? 'abstract' : ''}`}
      style={{ borderLeftColor: color }}
    >
      <Handle type="target" position={Position.Top} className="handle" />

      <div className="node-header">
        <span
          className="type-badge"
          style={{
            backgroundColor: `${color}20`,
            color,
          }}
        >
          {data.isAbstract ? 'abstract' : 'class'}
        </span>
        <span className="class-name">{data.label as string}</span>
      </div>

      {(data.methods as string[]).length > 0 && (
        <div className="node-methods">
          {(data.methods as string[]).map((m: string) => (
            <div key={m} className="method-line">
              <span className="method-icon">f</span>
              {m}
            </div>
          ))}
        </div>
      )}

      {(data.methods as string[]).length === 0 && (
        <div className="node-methods">
          <div className="method-line empty">inherited methods</div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="handle" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  packageGroup: PackageGroupNode,
  classNode: ClassNodeComponent,
};

/* ------------------------------------------------------------------ */
/*  Detail panel                                                       */
/* ------------------------------------------------------------------ */

function DetailPanel({ cls, onClose }: { cls: ClassDef; onClose: () => void }) {
  const pkg = packages[cls.pkg];
  const incoming = graphEdges.filter(e => e.target === cls.id);
  const outgoing = graphEdges.filter(e => e.source === cls.id);

  return (
    <div className="detail-panel">
      <button className="detail-close" onClick={onClose} aria-label="Close">
        &times;
      </button>

      <div className="detail-pkg-badge" style={{ color: pkg.color, backgroundColor: `${pkg.color}15` }}>
        {pkg.label}
      </div>

      <h3 className="detail-title">{cls.id}</h3>

      {cls.type === 'abstract' && <span className="detail-abstract-tag">abstract</span>}
      {cls.parent && (
        <div className="detail-extends">
          extends <span className="detail-parent-name">{cls.parent}</span>
        </div>
      )}

      {cls.props && cls.props.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-title">Properties</div>
          {cls.props.map(p => (
            <div key={p} className="detail-item prop">{p}</div>
          ))}
        </div>
      )}

      {cls.methods.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-title">Methods</div>
          {cls.methods.map(m => (
            <div key={m} className="detail-item method">{m}</div>
          ))}
        </div>
      )}

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className="detail-section">
          <div className="detail-section-title">Relationships</div>
          {incoming.filter(e => e.type === 'extends').map(e => (
            <div key={`in-${e.source}`} className="detail-item rel">
              <span className="rel-arrow">&#x25C0;</span> extended by <strong>{e.source}</strong>
            </div>
          ))}
          {outgoing.filter(e => e.type === 'extends').map(e => (
            <div key={`out-ext-${e.target}`} className="detail-item rel">
              <span className="rel-arrow">&#x25B6;</span> extends <strong>{e.target}</strong>
            </div>
          ))}
          {outgoing.filter(e => e.type === 'uses').map(e => (
            <div key={`out-use-${e.target}`} className="detail-item rel uses">
              <span className="rel-arrow">&#x25B6;</span> uses <strong>{e.target}</strong>
            </div>
          ))}
          {incoming.filter(e => e.type === 'uses').map(e => (
            <div key={`in-use-${e.source}`} className="detail-item rel uses">
              <span className="rel-arrow">&#x25C0;</span> used by <strong>{e.source}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="diagram-legend">
      <div className="legend-item">
        <span className="legend-line solid" /> extends
      </div>
      <div className="legend-item">
        <span className="legend-line dashed" /> uses
      </div>
      <div className="legend-item">
        <span className="legend-badge abstract">abstract</span>
      </div>
      <div className="legend-item">
        <span className="legend-badge cls">class</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ApiDiagram() {
  const [activePackages, setActivePackages] = useState<Set<string>>(
    () => new Set(Object.keys(packages)),
  );
  const [selectedClass, setSelectedClass] = useState<ClassDef | null>(null);

  const { nodes, edges } = useMemo(() => buildGraph(activePackages), [activePackages]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'packageGroup') return;
    const cls = classes.find(c => c.id === node.id) ?? null;
    setSelectedClass(cls);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedClass(null);
  }, []);

  const toggleGroup = (ids: string[]) => {
    setActivePackages(prev => {
      const next = new Set(prev);
      const allOn = ids.every(id => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const allPkgIds = Object.keys(packages);
  const allActive = allPkgIds.every(id => activePackages.has(id));
  const toggleAll = () => {
    if (allActive) setActivePackages(new Set());
    else setActivePackages(new Set(allPkgIds));
  };

  return (
    <div className="api-diagram-root">
      {/* Filter bar */}
      <div className="filter-bar">
        <button
          className={`filter-pill all ${allActive ? 'active' : ''}`}
          onClick={toggleAll}
        >
          {allActive ? 'Hide All' : 'Show All'}
        </button>
        {filterGroups.map(grp => {
          const isOn = grp.ids.every(id => activePackages.has(id));
          return (
            <button
              key={grp.label}
              className={`filter-pill ${isOn ? 'active' : ''}`}
              style={
                {
                  '--pill-color': grp.color,
                  '--pill-bg': `${grp.color}18`,
                } as React.CSSProperties
              }
              onClick={() => toggleGroup(grp.ids)}
            >
              <span className="pill-dot" style={{ backgroundColor: grp.color }} />
              {grp.label}
            </button>
          );
        })}
      </div>

      {/* Graph + detail */}
      <div className="diagram-body">
        <div className="diagram-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.05}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: 'smoothstep' }}
          >
            <Controls
              showInteractive={false}
              position="bottom-left"
            />
            <MiniMap
              nodeColor={(n: Node) => {
                if (n.type === 'packageGroup') return 'transparent';
                return packages[(n.data as Record<string, unknown>)?.pkg as string]?.color ?? '#30363d';
              }}
              maskColor="rgba(13,17,23,0.85)"
              style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}
              pannable
              zoomable
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="#21262d"
            />
            <Legend />
          </ReactFlow>
        </div>

        {selectedClass && (
          <DetailPanel cls={selectedClass} onClose={() => setSelectedClass(null)} />
        )}
      </div>
    </div>
  );
}
