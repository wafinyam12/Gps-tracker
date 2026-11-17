export const getAdminUserListPresentation = ({ loading, error, shown, total }) => {
  const visible = Number.isFinite(Number(shown)) ? Math.max(0, Number(shown)) : 0;
  const count = Number.isFinite(Number(total)) ? Math.max(visible, Number(total)) : visible;
  return {
    state: loading ? 'loading' : error ? 'error' : visible > 0 ? 'ready' : 'empty',
    result: count > visible ? `${visible} dari ${count} user ditampilkan` : `${visible} user ditampilkan`,
  };
};
