/* ---------- Strichliste für die Stufe ---------- */
export function Tally({ value }: { value: number }) {
  const groups = Math.floor(value / 5);
  const rest = value % 5;
  return (
    <>
      {Array.from({ length: groups }).map((_, g) => (
        <span key={g} className="tally-group">
          {[0, 1, 2, 3].map(i => <span key={i} className="tally-stroke" />)}
          <span className="tally-cross" />
        </span>
      ))}
      {rest > 0 && (
        <span className="tally-group">
          {Array.from({ length: rest }).map((_, i) => <span key={i} className="tally-stroke" />)}
        </span>
      )}
      {value === 0 && <span style={{ fontStyle: "italic", opacity: .6 }}>noch Landratte</span>}
    </>
  );
}
