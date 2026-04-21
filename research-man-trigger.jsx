import { useState } from "react";

const INDUSTRIES = [
  "Physical AI / Robot Foundation Model",
  "협동로봇 (Cobot)",
  "텔레오퍼레이션 / 원격조작",
  "산업용 로봇 (용접·핸들링·조립)",
  "휴머노이드",
  "AMR / 물류 자동화",
  "로봇 소프트웨어 / 시뮬레이션",
  "비전·센싱 (3D비전·LiDAR)",
  "그리퍼 / 엔드이펙터",
  "모터·액추에이터",
];

const FOCUS_OPTIONS = [
  { id: "기업 일반",       desc: "설립·지분·재무·매출" },
  { id: "최근 업력",       desc: "최근 12개월 뉴스·수주·발표" },
  { id: "기술 수준",       desc: "제품·특허·TRL" },
  { id: "구성원 프로파일", desc: "CEO·CTO·핵심 인력" },
  { id: "논문·연구 방향",  desc: "기술 지향점·저자 분석" },
  { id: "채용 현황",       desc: "포지션으로 R&D 방향 추론" },
  { id: "경쟁·시장 포지션",desc: "경쟁사 대비 위치" },
  { id: "리스크 신호",     desc: "임원 이탈·소송·재무 이상" },
];

const C = {
  bg: "#0A0A0C", card: "#111114", border: "#1E1E22",
  text: "#D8D5CC", dim: "#555",
  gold: "#C8A96E", green: "#00C9A7", blue: "#4285F4",
};

const s = {
  input: {
    width: "100%", background: C.bg, border: `1px solid #2A2A2E`,
    borderRadius: 4, padding: "8px 12px", color: C.text,
    fontSize: 12, fontFamily: "inherit", outline: "none",
  },
};

const Tag = ({ label, active, color = C.gold, onClick }) => (
  <button onClick={onClick} style={{
    padding: "5px 11px", borderRadius: 4, cursor: "pointer",
    fontFamily: "inherit", fontSize: 12, whiteSpace: "nowrap",
    transition: "all 0.15s",
    border: `1px solid ${active ? color : "#2A2A2E"}`,
    background: active ? color + "18" : "transparent",
    color: active ? color : C.dim,
  }}>{label}</button>
);

const Sec = ({ title, color, note, children }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 10, letterSpacing: "0.18em", color: color || "#444", marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
      {title}
      {note && <span style={{ color: C.gold, fontSize: 9 }}>{note}</span>}
    </div>
    {children}
  </div>
);

const ModelBtn = ({ label, desc, active, color, onClick }) => (
  <button onClick={onClick} style={{
    padding: "7px 11px", borderRadius: 4, cursor: "pointer",
    fontFamily: "inherit", textAlign: "left", fontSize: 11,
    transition: "all 0.15s",
    border: `1px solid ${active ? color : "#2A2A2E"}`,
    background: active ? color + "18" : "transparent",
    color: active ? color : C.dim,
  }}>
    <div>{label}</div>
    {desc && <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>{desc}</div>}
  </button>
);

export default function App() {
  const [company,       setCompany]       = useState("");
  const [region,        setRegion]        = useState([]);
  const [industries,    setIndustries]    = useState([]);
  const [size,          setSize]          = useState(null);
  const [purpose,       setPurpose]       = useState(null);
  const [focus,         setFocus]         = useState([]);
  const [pModel,        setPModel]        = useState("sonar-pro");
  const [gModel,        setGModel]        = useState("gemini-2.5-pro");
  const [meetingTopic,  setMeetingTopic]  = useState("");
  const [meetingComment,setMeetingComment]= useState("");
  const [extraRequest,  setExtraRequest]  = useState("");

  const toggle = (arr, set, v) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const isFindMode = !company.trim();
  const canRun =
    industries.length > 0 &&
    purpose !== null &&
    focus.length > 0 &&
    (!isFindMode || (size !== null && region.length > 0)) &&
    (purpose !== "미팅 준비" || meetingTopic.trim());

  const hint =
    !industries.length ? "산업을 선택해야 실행할 수 있어요" :
    !purpose ? "조사 목적을 선택해야 실행할 수 있어요" :
    !focus.length ? "조사 초점을 선택해야 실행할 수 있어요" :
    isFindMode && !region.length ? "탐색 모드: 지역을 선택해야 실행할 수 있어요" :
    isFindMode && size === null ? "탐색 모드: 규모를 선택해야 실행할 수 있어요" :
    purpose === "미팅 준비" && !meetingTopic.trim() ? "미팅 주제를 입력해야 실행할 수 있어요" : "";

  const submit = () => {
    if (!canRun) return;
    const msg = `[리서치맨 조사 요청]

조사 대상: ${company || "(탐색 모드 — 조건에 맞는 업체 탐색)"}
지역: ${region.length ? region.join("·") : "전체"}
산업: ${industries.join(", ")}
규모: ${size || "전체"}
목적: ${purpose}
초점: ${focus.join(", ")}
Perplexity 모델: ${pModel}
Gemini 모델: ${gModel}
${purpose === "미팅 준비" ? `미팅 주제: ${meetingTopic}\n우리 목적: ${meetingComment || "(미입력)"}` : ""}
${extraRequest ? `기타 요청: ${extraRequest}` : ""}

위 조건으로 리서치맨 풀리서치(research_man_full)를 실행해줘.`;

    window.sendPrompt(msg);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: 13, padding: 20 }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#444", marginBottom: 4 }}>HANWHA ROBOTICS — PARTNERSHIP INTEL</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>리서치맨 조사 설정</div>
      </div>

      {/* 업체명 */}
      <Sec title="업체명" note="비우면 업체 탐색 모드">
        <input type="text" value={company} onChange={e => setCompany(e.target.value)}
          placeholder="예: Physical Intelligence, 레인보우로보틱스... (비우면 조건에 맞는 업체 탐색)"
          style={s.input} />
        {!company && <div style={{ fontSize: 10, color: C.gold, marginTop: 5 }}>탐색 모드: 지역·규모 선택 필수</div>}
      </Sec>

      {/* 지역 */}
      <Sec title="지역">
        <div style={{ display: "flex", gap: 8 }}>
          {["국내", "해외"].map(r => (
            <Tag key={r} label={r} active={region.includes(r)} onClick={() => toggle(region, setRegion, r)} />
          ))}
        </div>
      </Sec>

      {/* 산업 */}
      <Sec title="산업 (복수 선택)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {INDUSTRIES.map(i => (
            <Tag key={i} label={i} active={industries.includes(i)} onClick={() => toggle(industries, setIndustries, i)} />
          ))}
        </div>
      </Sec>

      {/* 규모 */}
      <Sec title="업체 규모" note={!company ? "탐색 모드 필수" : ""}>
        <div style={{ display: "flex", gap: 8 }}>
          {["스타트업", "중소형", "대형 (ABB·FANUC급)"].map(s2 => (
            <Tag key={s2} label={s2} active={size === s2} onClick={() => setSize(size === s2 ? null : s2)} />
          ))}
        </div>
      </Sec>

      {/* 조사 목적 */}
      <Sec title="조사 목적">
        <div style={{ display: "flex", gap: 8 }}>
          {["시장조사", "미팅 준비", "협업 검토"].map(p => (
            <Tag key={p} label={p} active={purpose === p} onClick={() => setPurpose(purpose === p ? null : p)} />
          ))}
        </div>
      </Sec>

      {/* 미팅 컨텍스트 */}
      {purpose === "미팅 준비" && (
        <Sec title="미팅 컨텍스트" note="주제 필수">
          <input type="text" value={meetingTopic} onChange={e => setMeetingTopic(e.target.value)}
            placeholder="미팅 주제 (필수)"
            style={{ ...s.input, marginBottom: 8, borderColor: !meetingTopic.trim() ? "#E05C5C50" : "#2A2A2E" }} />
          <textarea value={meetingComment} onChange={e => setMeetingComment(e.target.value)}
            placeholder="우리 목적 / 사전 코멘트" rows={2}
            style={{ ...s.input, resize: "vertical" }} />
        </Sec>
      )}

      {/* 조사 초점 */}
      <Sec title="조사 초점 (복수 선택)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {FOCUS_OPTIONS.map(({ id, desc }) => (
            <button key={id} onClick={() => toggle(focus, setFocus, id)} style={{
              padding: "9px 12px", textAlign: "left", borderRadius: 4,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              background: focus.includes(id) ? C.gold + "10" : C.card,
              border: `1px solid ${focus.includes(id) ? C.gold + "50" : C.border}`,
            }}>
              <div style={{ fontSize: 12, color: focus.includes(id) ? C.gold : "#888", marginBottom: 2 }}>{id}</div>
              <div style={{ fontSize: 10, color: "#444" }}>{desc}</div>
            </button>
          ))}
        </div>
      </Sec>

      {/* Perplexity 모델 */}
      <Sec title="PERPLEXITY 모델" color={C.green}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "sonar",               d: "빠름·저렴" },
            { id: "sonar-pro",           d: "기본값·출처 2배" },
            { id: "sonar-deep-research", d: "초심층 (10~30분)" },
          ].map(({ id, d }) => (
            <ModelBtn key={id} label={id} desc={d} active={pModel === id} color={C.green} onClick={() => setPModel(id)} />
          ))}
        </div>
      </Sec>

      {/* Gemini 모델 */}
      <Sec title="GEMINI 모델" color={C.blue}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "gemini-2.5-flash", d: "빠름" },
            { id: "gemini-2.5-pro",   d: "기본값·멀티모달·문서 분석" },
          ].map(({ id, d }) => (
            <ModelBtn key={id} label={id.replace("gemini-", "")} desc={d} active={gModel === id} color={C.blue} onClick={() => setGModel(id)} />
          ))}
        </div>
      </Sec>

      {/* 기타 요청 */}
      <Sec title="기타 요청 (선택)">
        <textarea value={extraRequest} onChange={e => setExtraRequest(e.target.value)}
          placeholder="예: 한국 대리점 현황도 포함 / 창업자 X의 특허 이력 집중 분석 / 최근 한화 그룹과 접점 있는지"
          rows={3} style={{ ...s.input, resize: "vertical" }} />
      </Sec>

      {/* 실행 버튼 */}
      <button onClick={submit} disabled={!canRun} style={{
        width: "100%", padding: 13,
        background: canRun ? C.gold : "#1A1A1E",
        color: canRun ? C.bg : "#444",
        border: "none", borderRadius: 6,
        fontSize: 13, fontWeight: 700,
        cursor: canRun ? "pointer" : "default",
        fontFamily: "inherit", transition: "all 0.2s",
      }}>
        {company ? "심층 조사 시작" : "업체 탐색 시작"}
      </button>

      {hint && (
        <div style={{ fontSize: 11, color: C.dim, textAlign: "center", marginTop: 8 }}>{hint}</div>
      )}
    </div>
  );
}
