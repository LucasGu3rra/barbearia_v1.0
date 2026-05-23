export default function ClienteAgendamentoStepBar({ step }) {
  return (
    <div className="step-bar">
      {[1, 2, 3, 4].map((item, index) => (
        <span key={item} style={{ display: 'contents' }}>
          <div className={`sdot ${item < step ? 'done' : item === step ? 'cur' : ''}`}></div>
          {index < 3 && <div className={`sline ${item < step ? 'done' : ''}`}></div>}
        </span>
      ))}
    </div>
  );
}
