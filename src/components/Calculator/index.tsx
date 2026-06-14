import type { QuoteState, ProductConfig, Quote, PayPeriod } from '../../types'
import PricePanel from '../PricePanel'
import ProgressBar from '../ProgressBar'
import Step1Type from './Step1Type'
import Step2Location from './Step2Location'
import Step3Building from './Step3Building'
import Step4Security from './Step4Security'
import Step5Coverage from './Step5Coverage'
import StepResult from './StepResult'

interface Props {
  state: QuoteState
  setState: React.Dispatch<React.SetStateAction<QuoteState>>
  cfg: ProductConfig
  apiKey: string
  onSaveQuote: (q: Quote) => void
  onReset: () => void
}

export default function Calculator({ state, setState, cfg, apiKey, onSaveQuote, onReset }: Props) {
  const update = (patch: Partial<QuoteState>) => setState(s => ({ ...s, ...patch }))

  const setPayPeriod = (payPeriod: PayPeriod) => update({ payPeriod })

  return (
    <div className="calc-layout">
      <div>
        {state.step < 6 && <ProgressBar step={state.step} />}
        {state.step === 1 && <Step1Type state={state} onUpdate={update} />}
        {state.step === 2 && <Step2Location state={state} onUpdate={update} apiKey={apiKey} />}
        {state.step === 3 && <Step3Building state={state} onUpdate={update} cfg={cfg} />}
        {state.step === 4 && <Step4Security state={state} onUpdate={update} cfg={cfg} />}
        {state.step === 5 && <Step5Coverage state={state} onUpdate={update} cfg={cfg} />}
        {state.step === 6 && (
          <StepResult
            state={state}
            onUpdate={update}
            cfg={cfg}
            apiKey={apiKey}
            onSaveQuote={onSaveQuote}
            onReset={onReset}
          />
        )}
      </div>
      <PricePanel state={state} cfg={cfg} onPayPeriodChange={setPayPeriod} />
    </div>
  )
}
