(() => {
  window.SDSCMSTagSelection = createClass({
    getInitialState() { return { dropTarget: null, announcement: '' }; },
    move(from, to) {
      const { values, describe, onChange } = this.props;
      if (from === to || from >= values.length || to < 0 || to >= values.length) return;
      const next = [...values];
      const [value] = next.splice(from, 1);
      next.splice(to, 0, value);
      onChange(next);
      this.setState({ announcement: `${describe(value).label} moved to position ${to + 1} of ${next.length}.` });
    },
    stopDrag() {
      this.draggedIndex = undefined;
      if (this.state.dropTarget !== null) this.setState({ dropTarget: null });
    },
    render() {
      const { values, describe, onChange } = this.props;
      const canReorder = values.length > 1;
      const keyCounts = new Map();
      return h('div', null,
        h('div', { className: 'cms-tag-selection', role: 'list', 'aria-label': 'Selected tags' },
          values.map((value, index) => {
            const count = (keyCounts.get(value) || 0) + 1;
            keyCounts.set(value, count);
            const { label, style } = describe(value);
            const moveButton = (direction, offset, icon) => {
              const target = index + offset;
              const unavailable = target < 0 || target >= values.length;
              const description = `Move ${label} ${direction}`;
              return h('button', {
                type: 'button', title: description, 'aria-label': description,
                'aria-disabled': unavailable, tabIndex: unavailable ? -1 : 0,
                onClick: () => this.move(index, target)
              }, icon);
            };
            return h('span', {
              key: JSON.stringify([value, count]), role: 'listitem', className: 'cms-tag-chip', style,
              draggable: canReorder, 'data-drop-target': this.state.dropTarget === index ? '' : undefined,
              onDragStart: event => {
                event.dataTransfer.setData('application/x-sds-tag', label);
                event.dataTransfer.effectAllowed = 'move';
                this.draggedIndex = index;
              },
              onDragOver: event => {
                if (this.draggedIndex === undefined) return;
                event.preventDefault();
                const dropTarget = this.draggedIndex === index ? null : index;
                event.dataTransfer.dropEffect = dropTarget === null ? 'none' : 'move';
                if (dropTarget !== this.state.dropTarget) this.setState({ dropTarget });
              },
              onDrop: event => {
                if (this.draggedIndex === undefined) return;
                event.preventDefault();
                const from = this.draggedIndex;
                this.stopDrag();
                this.move(from, index);
              },
              onDragEnd: this.stopDrag
            },
            h('span', null, label),
            canReorder && h('span', { className: 'cms-tag-move' },
              moveButton('earlier', -1, '←'), moveButton('later', 1, '→')),
            h('button', {
              type: 'button', title: `Remove ${label}`, 'aria-label': `Remove ${label}`,
              className: 'cms-tag-remove', onClick: () => onChange(values.filter((_, i) => i !== index))
            }, '×'));
          })),
        h('span', { className: 'cms-tag-announcement', role: 'status' }, this.state.announcement),
        canReorder && h('p', { className: 'cms-tag-help' }, 'Drag a tag or use its arrow buttons to change its order.'));
    }
  });
})();
