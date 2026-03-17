import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Feature } from '@mapgpu/core';
import { SelectionInspectorWidget } from './SelectionInspectorWidget.js';

function createMockFeatures(count: number): Feature[] {
  const features: Feature[] = [];
  for (let i = 0; i < count; i++) {
    features.push({
      id: `feature-${i}`,
      geometry: { type: 'Point', coordinates: [i, i] },
      attributes: { name: `Feature ${i}`, value: i * 10 },
    });
  }
  return features;
}

describe('SelectionInspectorWidget', () => {
  let container: HTMLElement;
  let widget: SelectionInspectorWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new SelectionInspectorWidget({ id: 'inspector-test' });
    widget.mount(container);
  });

  it('should render with correct DOM structure', () => {
    const root = container.querySelector('#inspector-test');
    expect(root).not.toBeNull();
    expect(root!.classList.contains('mapgpu-widget-selection-inspector')).toBe(true);
  });

  it('should show "No features selected" when empty', () => {
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table!.textContent).toContain('No features selected');
  });

  it('should display feature count', () => {
    const countEl = container.querySelector('.feature-count');
    expect(countEl).not.toBeNull();
    expect(countEl!.textContent).toBe('0 features');
  });

  it('should render features as table rows', () => {
    const features = createMockFeatures(3);
    widget.setFeatures(features);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);

    const countEl = container.querySelector('.feature-count');
    expect(countEl!.textContent).toBe('3 features');
  });

  it('should display feature id and attributes in table', () => {
    const features = createMockFeatures(1);
    widget.setFeatures(features);

    const table = container.querySelector('table');
    // Should have header row with columns: id, name, value
    const headers = table!.querySelectorAll('th');
    expect(headers.length).toBe(3);

    const cells = table!.querySelectorAll('tbody td');
    expect(cells[0]!.textContent).toBe('feature-0');
    expect(cells[1]!.textContent).toBe('Feature 0');
    expect(cells[2]!.textContent).toBe('0');
  });

  it('should paginate when more than pageSize features', () => {
    const features = createMockFeatures(25);
    widget.setFeatures(features);

    // Default page size is 10
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(10);

    expect(widget.totalPages).toBe(3);
    expect(widget.currentPage).toBe(0);
  });

  it('should navigate to next page', () => {
    const features = createMockFeatures(25);
    widget.setFeatures(features);

    widget.nextPage();
    expect(widget.currentPage).toBe(1);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(10);
  });

  it('should navigate to previous page', () => {
    const features = createMockFeatures(25);
    widget.setFeatures(features);

    widget.goToPage(2);
    widget.prevPage();
    expect(widget.currentPage).toBe(1);
  });

  it('should show correct rows on last page', () => {
    const features = createMockFeatures(25);
    widget.setFeatures(features);

    widget.goToPage(2);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(5); // 25 - 20 = 5 remaining
  });

  it('should clamp page to valid range', () => {
    const features = createMockFeatures(25);
    widget.setFeatures(features);

    widget.goToPage(-5);
    expect(widget.currentPage).toBe(0);

    widget.goToPage(999);
    expect(widget.currentPage).toBe(2);
  });

  it('should render pagination controls', () => {
    const features = createMockFeatures(25);
    widget.setFeatures(features);

    const pagination = container.querySelector('.pagination');
    expect(pagination).not.toBeNull();

    const prevBtn = pagination!.querySelector('.prev-btn') as HTMLButtonElement;
    const nextBtn = pagination!.querySelector('.next-btn') as HTMLButtonElement;
    expect(prevBtn).not.toBeNull();
    expect(nextBtn).not.toBeNull();

    // First page: prev should be disabled
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
  });

  it('should show page info', () => {
    const features = createMockFeatures(25);
    widget.setFeatures(features);

    const pageInfo = container.querySelector('.page-info');
    expect(pageInfo!.textContent).toBe('1 / 3');
  });

  it('should clear selection', () => {
    const handler = vi.fn();
    widget.onClear(handler);

    const features = createMockFeatures(5);
    widget.setFeatures(features);

    widget.clearSelection();

    expect(widget.features).toHaveLength(0);
    expect(handler).toHaveBeenCalled();

    const countEl = container.querySelector('.feature-count');
    expect(countEl!.textContent).toBe('0 features');
  });

  it('should clear via button', () => {
    const features = createMockFeatures(5);
    widget.setFeatures(features);

    const clearBtn = container.querySelector('.clear-btn') as HTMLButtonElement;
    clearBtn.click();

    expect(widget.features).toHaveLength(0);
  });

  it('should unsubscribe clear handler', () => {
    const handler = vi.fn();
    widget.onClear(handler);
    widget.offClear(handler);

    widget.setFeatures(createMockFeatures(5));
    widget.clearSelection();

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not show pagination for <= pageSize features', () => {
    const features = createMockFeatures(5);
    widget.setFeatures(features);

    const pagination = container.querySelector('.pagination');
    // pagination exists but should be empty (no buttons)
    expect(pagination!.children.length).toBe(0);
  });

  it('should reset to page 0 when new features are set', () => {
    const features = createMockFeatures(25);
    widget.setFeatures(features);
    widget.goToPage(2);
    expect(widget.currentPage).toBe(2);

    widget.setFeatures(createMockFeatures(5));
    expect(widget.currentPage).toBe(0);
  });

  it('should handle singular feature count text', () => {
    widget.setFeatures(createMockFeatures(1));
    const countEl = container.querySelector('.feature-count');
    expect(countEl!.textContent).toBe('1 feature');
  });

  it('should clean up on destroy', () => {
    widget.destroy();
    expect(container.querySelector('#inspector-test')).toBeNull();
  });
});
