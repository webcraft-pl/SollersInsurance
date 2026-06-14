const STEPS = ['Typ', 'Lokalizacja', 'Budynek', 'Zabezpieczenia', 'Zakres']

export default function ProgressBar({ step }: { step: number }) {
  return (
    <div className="progress">
      {STEPS.map((label, i) => {
        const n = i + 1
        const cls = step > n ? 'ps done' : step === n ? 'ps active' : 'ps'
        return (
          <div key={n} className={cls}>
            <div className="ps-c">
              {step > n ? <i className="ti ti-check" /> : n}
            </div>
            <div className="ps-l">{label}</div>
          </div>
        )
      })}
    </div>
  )
}
