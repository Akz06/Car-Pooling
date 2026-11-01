/** Indian HSRP-style number plate. */
export function NumberPlate({ plate, size = 'md' }: { plate: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`plate plate--${size}`}>
      <span className="plate__ind">
        <svg viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4" fill="none" stroke="#fff" strokeWidth="0.8" />{Array.from({ length: 8 }, (_, i) => <line key={i} x1="5" y1="5" x2={5 + 4 * Math.cos((i * Math.PI) / 4)} y2={5 + 4 * Math.sin((i * Math.PI) / 4)} stroke="#fff" strokeWidth="0.5" />)}</svg>
        IND
      </span>
      <span className="plate__num">{plate}</span>
    </span>
  );
}
