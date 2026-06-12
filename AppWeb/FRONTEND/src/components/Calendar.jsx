import { useState } from 'react';
import styles from '../styles/Calendar.module.css';

const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function Calendar() {
  const today = new Date();
  const [current, setCurrent] = useState({ month: today.getMonth(), year: today.getFullYear() });

  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();

  function prev() {
    setCurrent(function(c) {
      if (c.month === 0) return { month: 11, year: c.year - 1 };
      return { month: c.month - 1, year: c.year };
    });
  }

  function next() {
    setCurrent(function(c) {
      if (c.month === 11) return { month: 0, year: c.year + 1 };
      return { month: c.month + 1, year: c.year };
    });
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayNames = DAYS.map(function(d) {
    return <div key={d} className={styles.calendarDayName}>{d}</div>;
  });

  const dayCells = cells.map(function(day, i) {
    let className = styles.calendarDay;
    if (day === today.getDate() && current.month === today.getMonth() && current.year === today.getFullYear()) {
      className = className + ' ' + styles.calendarToday;
    }
    if (day === null) {
      className = className + ' ' + styles.calendarEmpty;
    }
    return (
      <div key={i} className={className}>
        <span>{day}</span>
      </div>
    );
  });

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHeader}>
        <div className={styles.calendarTitleGroup}>
          <span className={styles.calendarMonth}>{MONTHS[current.month]}</span>
          <span className={styles.calendarYear}>{current.year}</span>
        </div>
        <div className={styles.calendarNavGroup}>
          <button onClick={prev} className={styles.calendarNav}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button onClick={next} className={styles.calendarNav}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>
      <div className={styles.calendarGrid}>
        {dayNames}
        {dayCells}
      </div>
    </div>
  );
}
