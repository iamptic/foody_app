
/* Простой помощник печати и якорей */
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  if (params.get('print') === '1') window.print();
});
