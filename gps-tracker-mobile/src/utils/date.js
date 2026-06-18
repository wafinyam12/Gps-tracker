import moment from 'moment';

export const getJakartaDateString = (offsetDays = 0) => (
  moment().utcOffset(7).add(offsetDays, 'day').format('YYYY-MM-DD')
);
