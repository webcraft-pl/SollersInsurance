import type { QuoteState, PropertyType } from '../../types'

const TYPES: { id: PropertyType; ico: string; n: string; d: string }[] = [
  { id: 'dom',        ico: 'ti-home-2',       n: 'Dom jednorodzinny', d: 'Wolnostojący lub bliźniak' },
  { id: 'mieszkanie', ico: 'ti-building',      n: 'Mieszkanie',        d: 'W bloku lub kamienicy' },
  { id: 'szeregowiec',ico: 'ti-layout-rows',   n: 'Dom szeregowy',     d: 'Zabudowa szeregowa' },
  { id: 'letniskowy', ico: 'ti-tent',          n: 'Dom letniskowy',    d: 'Rekreacyjny, sezonowy' },
]

interface Props {
  state: QuoteState
  onUpdate: (patch: Partial<QuoteState>) => void
}

export default function Step1Type({ state, onUpdate }: Props) {
  return (
    <div className="card fade-in">
      <div className="step-h">Jaki typ nieruchomości ubezpieczyć?</div>
      <div className="tgrid">
        {TYPES.map(t => (
          <div
            key={t.id}
            className={`tc${state.type === t.id ? ' sel' : ''}`}
            onClick={() => onUpdate({ type: t.id })}
          >
            <div className="tc-ico"><i className={`ti ${t.ico}`} /></div>
            <div className="tc-n">{t.n}</div>
            <div className="tc-d">{t.d}</div>
          </div>
        ))}
      </div>
      <div className="nav">
        <span />
        <button
          className="btn prim"
          disabled={!state.type}
          onClick={() => onUpdate({ step: 2 })}
        >
          Dalej <i className="ti ti-arrow-right" />
        </button>
      </div>
    </div>
  )
}
