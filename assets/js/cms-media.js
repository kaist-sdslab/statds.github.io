(() => {
  const settings = JSON.parse(document.getElementById('cms-media-settings').textContent);
  const image = CMS.getWidget('image');
  const publicImagePath = value => {
    if (typeof value !== 'string' || /^(?:[a-z]+:|\/\/)/i.test(value)) return value;
    const media = value.match(/(?:^|\/)media\/(.+)$/);
    return media ? `${settings.basePath}media/${media[1]}` : value;
  };
  const ImageControl = createClass({
    // Decap delegates update checks to the underlying file control. Forward its
    // instance so selecting media also delivers updated controlMedia props.
    getWrappedInstance() { return this.control; },
    render() {
      const getAsset = (value, field) => {
        const publicPath = publicImagePath(value);
        if (publicPath !== value || (typeof value === 'string' && value.startsWith(settings.basePath + 'media/'))) {
          // Draft uploads live in the asset cache until the entry is saved.
          const relative = String(publicPath).slice(settings.basePath.length);
          const cached = this.props.getAsset(relative, field);
          if (cached.path !== 'empty.svg' && cached.url && cached.url.startsWith('blob:')) return cached;
        }
        // Existing files resolve immediately instead of retaining an empty SVG.
        return this.props.getAsset(publicPath, field);
      };
      return h(image.control, { ...this.props, getAsset, ref: control => { this.control = control; } });
    }
  });
  CMS.registerWidget({
    name: 'image', controlComponent: ImageControl, previewComponent: image.preview,
    schema: image.schema, globalStyles: image.globalStyles, allowMapValue: image.allowMapValue
  });
})();
