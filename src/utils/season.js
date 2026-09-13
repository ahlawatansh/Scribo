
export function getCurrentMonthKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  return `${year}_${String(month).padStart(2, '0')}`;
}

export function getCurrentMonthDisplay() {
  const today = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[today.getMonth()]} ${today.getFullYear()}`;
}
