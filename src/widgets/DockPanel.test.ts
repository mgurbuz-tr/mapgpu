import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IWidget, IView, WidgetPosition } from '../core/index.js';
import { DockPanel } from './DockPanel.js';
import { WidgetBase } from './WidgetBase.js';

class MockWidget extends WidgetBase {
  renderCount = 0;

  constructor(id: string) {
    super('mock', { id });
  }

  protected render(root: HTMLElement): void {
    this.renderCount++;
    const inner = document.createElement('span');
    inner.textContent = `Widget ${this.id}`;
    root.appendChild(inner);
  }
}

describe('DockPanel', () => {
  let container: HTMLElement;
  let panel: DockPanel;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    panel = new DockPanel({ id: 'dock-test' });
    panel.mount(container);
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#dock-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-dockpanel')).toBe(true);
  });

  it('should create four dock containers', () => {
    const root = container.querySelector('#dock-test');
    expect(root!.querySelector('.dock-left')).not.toBeNull();
    expect(root!.querySelector('.dock-right')).not.toBeNull();
    expect(root!.querySelector('.dock-top')).not.toBeNull();
    expect(root!.querySelector('.dock-bottom')).not.toBeNull();
  });

  it('should add widget to left panel', () => {
    const widget = new MockWidget('w1');
    panel.addWidget(widget, 'left');

    expect(panel.widgets).toHaveLength(1);
    expect(panel.widgets[0]!.dockPosition).toBe('left');

    const wrapper = container.querySelector('[data-dock-widget-id="w1"]');
    expect(wrapper).not.toBeNull();
  });

  it('should not add duplicate widget', () => {
    const widget = new MockWidget('w1');
    panel.addWidget(widget, 'left');
    panel.addWidget(widget, 'right');

    expect(panel.widgets).toHaveLength(1);
  });

  it('should add widgets to different panels', () => {
    const w1 = new MockWidget('w1');
    const w2 = new MockWidget('w2');
    const w3 = new MockWidget('w3');

    panel.addWidget(w1, 'left');
    panel.addWidget(w2, 'right');
    panel.addWidget(w3, 'bottom');

    expect(panel.widgets).toHaveLength(3);
    expect(panel.getWidgetsAt('left')).toHaveLength(1);
    expect(panel.getWidgetsAt('right')).toHaveLength(1);
    expect(panel.getWidgetsAt('bottom')).toHaveLength(1);
    expect(panel.getWidgetsAt('top')).toHaveLength(0);
  });

  it('should remove widget', () => {
    const widget = new MockWidget('w1');
    panel.addWidget(widget, 'left');
    panel.removeWidget(widget);

    expect(panel.widgets).toHaveLength(0);
    const wrapper = container.querySelector('[data-dock-widget-id="w1"]');
    expect(wrapper).toBeNull();
  });

  it('should remove widget by id string', () => {
    const widget = new MockWidget('w1');
    panel.addWidget(widget, 'left');
    panel.removeWidget('w1');

    expect(panel.widgets).toHaveLength(0);
  });

  it('should be safe to remove non-existent widget', () => {
    expect(() => panel.removeWidget('non-existent')).not.toThrow();
  });

  it('should collapse panel', () => {
    const widget = new MockWidget('w1');
    panel.addWidget(widget, 'left');

    panel.collapsePanel('left');
    expect(panel.isCollapsed('left')).toBe(true);

    const root = container.querySelector('#dock-test');
    const leftPanel = root!.querySelector('.dock-left .dock-panel-content') as HTMLElement;
    expect(leftPanel.style.display).toBe('none');
  });

  it('should expand panel', () => {
    panel.collapsePanel('left');
    expect(panel.isCollapsed('left')).toBe(true);

    panel.expandPanel('left');
    expect(panel.isCollapsed('left')).toBe(false);

    const root = container.querySelector('#dock-test');
    const leftPanel = root!.querySelector('.dock-left .dock-panel-content') as HTMLElement;
    expect(leftPanel.style.display).toBe('block');
  });

  it('should toggle panel collapse', () => {
    panel.togglePanel('right');
    expect(panel.isCollapsed('right')).toBe(true);

    panel.togglePanel('right');
    expect(panel.isCollapsed('right')).toBe(false);
  });

  it('should toggle via button click', () => {
    const root = container.querySelector('#dock-test');
    const leftToggle = root!.querySelector('.dock-left .toggle-btn') as HTMLButtonElement;

    leftToggle.click();
    expect(panel.isCollapsed('left')).toBe(true);

    leftToggle.click();
    expect(panel.isCollapsed('left')).toBe(false);
  });

  it('should return widgets at a specific position', () => {
    const w1 = new MockWidget('w1');
    const w2 = new MockWidget('w2');
    const w3 = new MockWidget('w3');

    panel.addWidget(w1, 'left');
    panel.addWidget(w2, 'left');
    panel.addWidget(w3, 'right');

    const leftWidgets = panel.getWidgetsAt('left');
    expect(leftWidgets).toHaveLength(2);
    expect(leftWidgets[0]!.id).toBe('w1');
    expect(leftWidgets[1]!.id).toBe('w2');
  });

  it('should clean up all widgets on destroy', () => {
    const w1 = new MockWidget('w1');
    const w2 = new MockWidget('w2');
    panel.addWidget(w1, 'left');
    panel.addWidget(w2, 'right');

    panel.destroy();

    expect(container.querySelector('#dock-test')).toBeNull();
  });

  it('should not mount widget when panel is collapsed', () => {
    panel.collapsePanel('left');

    const widget = new MockWidget('w-collapsed');
    panel.addWidget(widget, 'left');

    const wrapper = container.querySelector('[data-dock-widget-id="w-collapsed"]');
    expect(wrapper).toBeNull();
  });

  it('should rebuild content when expanding previously collapsed panel', () => {
    panel.collapsePanel('left');

    const widget = new MockWidget('w-rebuild');
    panel.addWidget(widget, 'left');

    panel.expandPanel('left');

    const wrapper = container.querySelector('[data-dock-widget-id="w-rebuild"]');
    expect(wrapper).not.toBeNull();
  });
});
