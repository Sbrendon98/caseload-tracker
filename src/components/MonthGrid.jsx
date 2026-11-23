// One month of days. A dot marks a day with time logged; tapping a day calls onPickDay(date).
import { formatDateLong } from '../../js/format.js';
import { dayOfWeek, parseISO } from '../../js/dates.js';
import { formatDurationSeconds } from '../../js/durations.js';

const dotLevel = seconds => (seconds >= 180 * 60 ? 3 : seconds >= 60 * 60 ? 2 : 1);
const isWeekend = date => [0, 6].includes(dayOfWeek(date));

function weekdayLetter(iso) {
  const { y, m, d } = parseISO(iso);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'narrow' });
}

function DayCell({ date, inMonth, seconds, isToday, onPick }) {
  const classes = ['cal-cell', !inMonth && 'out', isWeekend(date) && 'weekend', isToday && 'today'];
  const label = seconds > 0 ? `${formatDateLong(date)}, ${formatDurationSeconds(seconds)} logged` : formatDateLong(date);
  return (
    <button type="button" class={classes.filter(Boolean).join(' ')} disabled={!inMonth} aria-label={label} onClick={() => onPick(date)}>
      <span class="num">{parseISO(date).d}</span>
      {seconds > 0 && <span class={`dot lvl${dotLevel(seconds)}`} aria-hidden="true" />}
    </button>
  );
}

/** weeks: from monthGrid(); secondsByDay: Map of date -> seconds logged. */
export function MonthGrid({ weeks, secondsByDay, todayIso, onPickDay }) {
  return (
    <div class="cal-grid">
      <div class="cal-row cal-head" aria-hidden="true">
        {weeks[0].map(({ date }) => <span key={date}>{weekdayLetter(date)}</span>)}
      </div>
      {weeks.map(week => (
        <div key={week[0].date} class="cal-row">
          {week.map(({ date, inMonth }) => (
            <DayCell
              key={date} date={date} inMonth={inMonth} seconds={secondsByDay.get(date) ?? 0}
              isToday={date === todayIso} onPick={onPickDay}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
