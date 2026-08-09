export function LoadingScreen({ text = "Segel setzen …" }: { text?: string }) {
  return (
    <div className="lade-schirm">
      <div className="anker" aria-hidden>⚓</div>
      <div style={{ fontStyle: "italic", opacity: .8 }}>{text}</div>
    </div>
  );
}
