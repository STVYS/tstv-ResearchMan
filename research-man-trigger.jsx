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
  { id: "기업 일반",        desc: "설립·지분·재무·매출" },
  { id: "최근 업력",        desc: "최근 12개월 뉴스·수주·발표" },
  { id: "기술 수준",        desc: "제품·특허·TRL" },
  { id: "구성원 프로파일",  desc: "CEO·CTO·핵심 인력" },
  { id: "논문·연구 방향",   desc: "기술 지향점·저자 분석" },
  { id: "채용 현황",        desc: "포지션으로 R&D 방향 추론" },
  { id: "경쟁·시장 포지션", desc: "경쟁사 대비 위치" },
  { id: "리스크 신호",      desc: "임원 이탈·소송·재무 이상" },
];

const C = { bg:"#0A0A0C", card:"#111114", border:"#1E1E22", text:"#D8D5CC", dim:"#555", gold:"#C8A96E", green:"#00C9A7", blue:"#4285F4" };

const inp = { width:"100%", background:"#0A0A0C", border:"1px solid #2A2A2E", borderRadius:4, padding:"8px 12px", color:"#D8D5CC", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

const Tag = ({ label, active, color="#C8A96E", onClick }) => (
  <button onClick={onClick} style={{ padding:"5px 11px", borderRadius:4, cursor:"pointer", fontFamily:"inherit", fontSize:12, whiteSpace:"nowrap", transition:"all 0.15s", border:`1px solid ${active?color:"#2A2A2E"}`, background:active?color+"18":"transparent", color:active?color:"#555" }}>{label}</button>
);

const Sec = ({ title, color, note, children }) => (
  <div style={{ marginBottom:18 }}>
    <div style={{ fontSize:10, letterSpacing:"0.18em", color:color||"#444", marginBottom:10, display:"flex", gap:8, alignItems:"center" }}>
      {title}{note && <span style={{ color:"#C8A96E", fontSize:9 }}>{note}</span>}
    </div>
    {children}
  </div>
);

const MBtn = ({ label, desc, active, color, onClick }) => (
  <button onClick={onClick} style={{ padding:"7px 11px", borderRadius:4, cursor:"pointer", fontFamily:"inherit", textAlign:"left", fontSize:11, transition:"all 0.15s", border:`1px solid ${active?color:"#2A2A2E"}`, background:active?color+"18":"transparent", color:active?color:"#555" }}>
    <div>{label}</div>
    {desc && <div style={{ fontSize:9, color:"#444", marginTop:1 }}>{desc}</div>}
  </button>
);

export default function App() {
  const [company,        setCompany]        = useState("");
  const [region,         setRegion]         = useState([]);
  const [industries,     setIndustries]     = useState([]);
  const [size,           setSize]           = useState(null);
  const [purpose,        setPurpose]        = useState(null);
  const [focus,          setFocus]          = useState([]);
  const [pModel,         setPModel]         = useState("sonar-pro");
  const [gModel,         setGModel]         = useState("gemini-2.5-pro");
  const [meetingTopic,   setMeetingTopic]   = useState("");
  const [meetingComment, setMeetingComment] = useState("");
  const [extraRequest,   setExtraRequest]   = useState("");
  const [otherIndustry,  setOtherIndustry]  = useState("");
  const [otherPurpose,   setOtherPurpose]   = useState("");
  const [done,           setDone]           = useState(false);

  const tog = (arr, set, v) => set(arr.includes(v) ? arr.filter(x=>x!==v) : [...arr,v]);
  const isFindMode = company.trim() === "";

  // canRun: 단계별 체크
  const step1 = industries.length > 0 && (!industries.includes("기타") || otherIndustry.trim().length > 0);
  const step2 = purpose !== null && (purpose !== "기타" || otherPurpose.trim().length > 0);
  const step3 = focus.length > 0;
  const step4 = isFindMode ? (size !== null && region.length > 0) : true;
  const step5 = purpose !== "미팅 준비" || meetingTopic.trim().length > 0;
  const canRun = step1 && step2 && step3 && step4 && step5;

  const hint =
    !step1 ? (!industries.length ? "산업 선택 필요" : "산업 기타 입력 필요") :
    !step2 ? (!purpose ? "조사 목적 선택 필요" : "목적 기타 입력 필요") :
    !step3 ? "조사 초점 선택 필요" :
    !step4 ? (isFindMode && !region.length ? "탐색 모드: 지역 선택 필요" : "탐색 모드: 규모 선택 필요") :
    !step5 ? "미팅 주제 입력 필요" : "";

  const submit = () => {
    if (!canRun) return;
    const effInd = industries.map(i => i==="기타" ? otherIndustry.trim() : i).filter(Boolean);
    const effPurpose = purpose === "기타" ? otherPurpose.trim() : purpose;
    const msg = `[리서치맨 조사 요청]
조사 대상: ${company.trim() || "(탐색 모드)"}
지역: ${region.length ? region.join("·") : "전체"}
산업: ${effInd.join(", ")}
규모: ${size || "전체"}
목적: ${effPurpose}
초점: ${focus.join(", ")}
Perplexity 모델: ${pModel}
Gemini 모델: ${gModel}
${purpose==="미팅 준비" ? `미팅 주제: ${meetingTopic}\n우리 목적: ${meetingComment||"(미입력)"}` : ""}
${extraRequest ? `기타 요청: ${extraRequest}` : ""}
위 조건으로 research_man_full 툴을 실행해줘.`;

    if (window.sendPrompt) {
      window.sendPrompt(msg);
      setDone(true);
    } else {
      setMsg(msg);
      setDone(true);
    }
  };

  const [msg, setMsg] = useState("");

  if (done) return (
    <div style={{ minHeight:"100vh", background:"#0A0A0C", color:"#D8D5CC", fontFamily:"'IBM Plex Mono','Courier New',monospace", fontSize:13, padding:20 }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ color:"#C8A96E", fontWeight:700, marginBottom:4 }}>✓ 조사 요청 준비됨</div>
        <div style={{ fontSize:11, color:"#555" }}>{window.sendPrompt ? "대화창에서 결과 확인" : "아래 내용을 Claude 대화창에 붙여넣어줘"}</div>
      </div>
      {!window.sendPrompt && (
        <div style={{ background:"#111", border:"1px solid #333", borderRadius:6, padding:14, fontSize:11, color:"#888", whiteSpace:"pre-wrap", marginBottom:16 }}>{msg}</div>
      )}
      <button onClick={()=>setDone(false)} style={{ background:"transparent", border:"1px solid #333", borderRadius:4, color:"#555", padding:"8px 16px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>다시 설정</button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0C", color:"#D8D5CC", fontFamily:"'IBM Plex Mono','Courier New',monospace", fontSize:13, padding:20 }}>
      <div style={{ borderBottom:"1px solid #1E1E22", paddingBottom:14, marginBottom:20 }}>
        <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#444", marginBottom:4 }}>HANWHA ROBOTICS — PARTNERSHIP INTEL</div>
        <div style={{ fontSize:16, fontWeight:700 }}>리서치맨 조사 설정</div>
      </div>

      <Sec title="업체명" note="비우면 탐색 모드">
        <input type="text" value={company} onChange={e=>setCompany(e.target.value)} placeholder="예: Physical Intelligence (비우면 업체 탐색)" style={inp} />
        {isFindMode && <div style={{ fontSize:10, color:"#C8A96E", marginTop:5 }}>탐색 모드: 지역·규모 선택 필수</div>}
      </Sec>

      <Sec title="지역">
        <div style={{ display:"flex", gap:8 }}>
          {["국내","해외"].map(r=><Tag key={r} label={r} active={region.includes(r)} onClick={()=>tog(region,setRegion,r)} />)}
        </div>
      </Sec>

      <Sec title="산업 (복수 선택)">
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {[...INDUSTRIES,"기타"].map(i=><Tag key={i} label={i} active={industries.includes(i)} onClick={()=>tog(industries,setIndustries,i)} />)}
        </div>
        {industries.includes("기타") && <input type="text" value={otherIndustry} onChange={e=>setOtherIndustry(e.target.value)} placeholder="산업 직접 입력" style={{...inp, marginTop:8}} />}
      </Sec>

      <Sec title="업체 규모" note={isFindMode?"탐색 모드 필수":""}>
        <div style={{ display:"flex", gap:8 }}>
          {["스타트업","중소형","대형 (ABB·FANUC급)"].map(s2=><Tag key={s2} label={s2} active={size===s2} onClick={()=>setSize(size===s2?null:s2)} />)}
        </div>
      </Sec>

      <Sec title="조사 목적">
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {["시장조사","미팅 준비","협업 검토","기타"].map(p=><Tag key={p} label={p} active={purpose===p} onClick={()=>setPurpose(purpose===p?null:p)} />)}
        </div>
        {purpose==="기타" && <input type="text" value={otherPurpose} onChange={e=>setOtherPurpose(e.target.value)} placeholder="목적 직접 입력" style={{...inp, marginTop:8}} />}
      </Sec>

      {purpose==="미팅 준비" && (
        <Sec title="미팅 컨텍스트" note="주제 필수">
          <input type="text" value={meetingTopic} onChange={e=>setMeetingTopic(e.target.value)} placeholder="미팅 주제 (필수)" style={{...inp, marginBottom:8, borderColor:!meetingTopic.trim()?"#E05C5C50":"#2A2A2E"}} />
          <textarea value={meetingComment} onChange={e=>setMeetingComment(e.target.value)} placeholder="우리 목적 / 사전 코멘트" rows={2} style={{...inp, resize:"vertical"}} />
        </Sec>
      )}

      <Sec title="조사 초점 (복수 선택)">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {FOCUS_OPTIONS.map(({id,desc})=>(
            <button key={id} onClick={()=>tog(focus,setFocus,id)} style={{ padding:"9px 12px", textAlign:"left", borderRadius:4, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s", background:focus.includes(id)?"#C8A96E10":"#111114", border:`1px solid ${focus.includes(id)?"#C8A96E50":"#1E1E22"}` }}>
              <div style={{ fontSize:12, color:focus.includes(id)?"#C8A96E":"#888", marginBottom:2 }}>{id}</div>
              <div style={{ fontSize:10, color:"#444" }}>{desc}</div>
            </button>
          ))}
        </div>
      </Sec>

      <Sec title="PERPLEXITY 모델" color="#00C9A7">
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[{id:"sonar",d:"빠름·저렴"},{id:"sonar-pro",d:"기본값·출처 2배"},{id:"sonar-deep-research",d:"초심층 (10~30분)"}].map(({id,d})=>(
            <MBtn key={id} label={id} desc={d} active={pModel===id} color="#00C9A7" onClick={()=>setPModel(id)} />
          ))}
        </div>
      </Sec>

      <Sec title="GEMINI 모델" color="#4285F4">
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[{id:"gemini-2.5-flash",d:"빠름"},{id:"gemini-2.5-pro",d:"기본값·멀티모달·문서 분석"}].map(({id,d})=>(
            <MBtn key={id} label={id.replace("gemini-","")} desc={d} active={gModel===id} color="#4285F4" onClick={()=>setGModel(id)} />
          ))}
        </div>
      </Sec>

      <Sec title="기타 요청 (선택)">
        <textarea value={extraRequest} onChange={e=>setExtraRequest(e.target.value)} placeholder="예: 한국 대리점 현황도 포함 / 창업자 X의 특허 이력 집중 분석" rows={3} style={{...inp, resize:"vertical"}} />
      </Sec>

      <button onClick={()=>{ if(canRun) submit(); }} style={{ width:"100%", padding:13, background:canRun?"#C8A96E":"#1A1A1E", color:canRun?"#0A0A0C":"#444", border:"none", borderRadius:6, fontSize:13, fontWeight:700, cursor:canRun?"pointer":"not-allowed", fontFamily:"inherit", transition:"all 0.2s", opacity:canRun?1:0.5 }}>
        {company.trim() ? "심층 조사 시작" : "업체 탐색 시작"}
      </button>

      {hint && <div style={{ fontSize:11, color:"#555", textAlign:"center", marginTop:8 }}>{hint}</div>}

      {/* 디버그 */}
      <div style={{ marginTop:16, padding:12, background:"#111", borderRadius:6, fontSize:10, color:"#666", lineHeight:1.8 }}>
        <div>step1(산업): {String(step1)} | industries: {JSON.stringify(industries)}</div>
        <div>step2(목적): {String(step2)} | purpose: {String(purpose)}</div>
        <div>step3(초점): {String(step3)} | focus: {JSON.stringify(focus)}</div>
        <div>step4(지역/규모): {String(step4)} | region: {JSON.stringify(region)} | size: {String(size)}</div>
        <div>step5(미팅): {String(step5)}</div>
        <div style={{color:"#C8A96E"}}>canRun: {String(canRun)} | isFindMode: {String(isFindMode)}</div>
      </div>
    </div>
  );
}
