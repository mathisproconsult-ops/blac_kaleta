"use client";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i);

const selectClassName =
  "flex-1 border border-zinc-300 px-2 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100";

export function DateOfBirthFields({
  day,
  month,
  year,
  onDayChange,
  onMonthChange,
  onYearChange,
}: {
  day: string;
  month: string;
  year: string;
  onDayChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <select
        value={day}
        onChange={(event) => onDayChange(event.target.value)}
        required
        aria-label="Jour de naissance"
        className={selectClassName}
      >
        <option value="">Jour</option>
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(event) => onMonthChange(event.target.value)}
        required
        aria-label="Mois de naissance"
        className={selectClassName}
      >
        <option value="">Mois</option>
        {MONTHS.map((label, index) => (
          <option key={label} value={index + 1}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(event) => onYearChange(event.target.value)}
        required
        aria-label="Année de naissance"
        className={selectClassName}
      >
        <option value="">Année</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
