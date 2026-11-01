export function SeatLegend() {
  return (
    <div className="legend">
      <span><i className="dot dot--free" /> Free seat</span>
      <span><i className="dot dot--M">♂</i> Booked · Male</span>
      <span><i className="dot dot--F">♀</i> Booked · Female</span>
      <span><i className="dot dot--sel">✓</i> Your pick</span>
      <span><i className="dot dot--na">×</i> Not offered</span>
    </div>
  );
}
