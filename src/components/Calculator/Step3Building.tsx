import type { QuoteState, ProductConfig, Material } from '../../types'

interface Props {
  state: QuoteState
  onUpdate: (patch: Partial<QuoteState>) => void
  cfg: ProductConfig
}

export default function Step3Building({ state, onUpdate, cfg }: Props) {
  const isHouse = state.type !== 'mieszkanie'
  const showRenovation = state.year < 1945

  return (
    <div className="card fade-in">
      <div className="step-h">Parametry budynku</div>
      <div className="g2">
        <div className="fl">
          <label className="fl-l">Rok budowy</label>
          <input
            type="number"
            value={state.year}
            min={1800}
            max={2025}
            onChange={e => onUpdate({ year: parseInt(e.target.value) || 1990 })}
          />
        </div>
        <div className="fl">
          <label className="fl-l">Materiał ścian</label>
          <select
            value={state.material}
            onChange={e => onUpdate({ material: e.target.value as Material })}
          >
            <option value="mur">Mur (cegła / beton)</option>
            <option value="drewno">Drewno / szkielet</option>
            <option value="prefabrykat">Prefabrykat / wielka płyta</option>
          </select>
        </div>
      </div>

      {showRenovation && (
        <div className="warn-box">
          <div>
            <div className="warn-box-t"><i className="ti ti-history" /> Budynek sprzed 1945 roku</div>
            <div className="warn-box-d">Czy budynek przeszedł gruntowny remont kapitalny?</div>
          </div>
          <button
            className={`toggle${state.renovation ? ' on' : ''}`}
            onClick={() => onUpdate({ renovation: !state.renovation })}
          />
        </div>
      )}

      <div className="g2">
        <div className="fl">
          <label className="fl-l">Powierzchnia użytkowa</label>
          <div className="iw">
            <input
              type="number"
              value={state.area}
              min={20}
              max={2000}
              onChange={e => onUpdate({ area: parseInt(e.target.value) || 0 })}
            />
            <span className="iw-s">m²</span>
          </div>
        </div>
        {isHouse ? (
          <div className="fl">
            <label className="fl-l">Kondygnacje</label>
            <select value={state.floors} onChange={e => onUpdate({ floors: parseInt(e.target.value) })}>
              <option value={1}>1 — parterowy</option>
              <option value={2}>2 kondygnacje</option>
              <option value={3}>3 i więcej</option>
            </select>
          </div>
        ) : <div />}
      </div>

      <div className="fl">
        <label className="fl-l">Szacowana wartość nieruchomości</label>
        <div className="iw">
          <input
            type="number"
            value={state.value}
            min={cfg.minVal}
            max={cfg.maxVal}
            step={10000}
            onChange={e => onUpdate({ value: parseInt(e.target.value) || 0 })}
          />
          <span className="iw-s">PLN</span>
        </div>
        <div className="fl-h">Wartość odtworzeniowa — koszt odbudowy w razie całkowitej straty</div>
      </div>

      <div className="nav">
        <button className="btn ghost" onClick={() => onUpdate({ step: 2 })}>
          <i className="ti ti-arrow-left" /> Wstecz
        </button>
        <button className="btn prim" onClick={() => onUpdate({ step: 4 })}>
          Dalej <i className="ti ti-arrow-right" />
        </button>
      </div>
    </div>
  )
}
