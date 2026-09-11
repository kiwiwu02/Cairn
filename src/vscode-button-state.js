export function getVscodeButtonState({localSource, hasSelectedFile, unavailableTitle = ''}) {
  const visible = Boolean(hasSelectedFile);
  const enabled = visible && localSource === 'bridge';
  return {visible, enabled, title: enabled ? '' : unavailableTitle};
}
