
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const selectScreen = $("selectScreen");
  const playScreen = $("playScreen");
  const resultScreen = $("resultScreen");
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");
  const audio = $("music");
  const startButton = $("startButton");
  const difficultyButtons = [...document.querySelectorAll("#difficultyButtons .diff-btn")];
  const KEYS = ["KeyF","KeyG","KeyH","KeyJ"];
  const KEY_LABELS = ["F","G","H","J"];
  const WINDOWS = [
    {name:"PERFECT",edge:10,score:500,color:"#fff1a8"},
    {name:"GREAT",edge:15,score:400,color:"#83e8ff"},
    {name:"GOOD",edge:25,score:200,color:"#a6a0ff"},
    {name:"BAD",edge:50,score:0,color:"#ff9d83"},
    {name:"MISS",edge:Infinity,score:-100,color:"#ff6689"}
  ];
  let difficulty = "NORMAL";
  const JUDGE_PRESETS = {EASY:{label:"甘口",multiplier:2.0,description:"判定幅が従来の2倍。タイミングを合わせやすい設定。"},NORMAL:{label:"普通",multiplier:1.5,description:"判定幅が従来の1.5倍。標準的なおすすめ設定。"},HARD:{label:"辛口",multiplier:1.0,description:"従来どおりの判定幅。高い精度が求められる設定。"}};
  let judgeMode = "NORMAL";
  const judgeButtons = [...document.querySelectorAll(".judge-option")];
  let speedMultiplier = 1.0;
  const speedSlider = $("speedSlider");
  const speedValue = $("speedValue");
  let notes = [];
  let activeHolds = [null,null,null,null];
  let chartData = null;
  let startAt = 0;
  let running = false;
  let raf = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let judged = {PERFECT:0,GREAT:0,GOOD:0,BAD:0,MISS:0};
  let lastJudge = null;
  let lastJudgeAt = 0;
  let pressed = [false,false,false,false];
  let flashes = [0,0,0,0];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let totalNotes = 0;
  let duration = 180;
  let BPM = 72;
  let BEAT = 60 / BPM;
  const CHART_URL = "charts/g-string-air.json";
  const LANE_COLORS = ["#68dff2","#9c91ff","#f3a0d0","#8de0b2"];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width*dpr);
    canvas.height = Math.round(height*dpr);
    canvas.style.width = width+"px";
    canvas.style.height = height+"px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener("resize", resize);
  resize();

  function setSpeed(value) {
    speedMultiplier = Math.max(0.5, Math.min(5, Math.round(value*10)/10));
    speedSlider.value = speedMultiplier.toFixed(1);
    speedValue.textContent = "×" + speedMultiplier.toFixed(1);
  }
  speedSlider.addEventListener("input", () => setSpeed(Number(speedSlider.value)));

  judgeButtons.forEach(button => button.addEventListener("click", () => {
    judgeMode = button.dataset.judge;
    judgeButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    $("judgeDescription").textContent = JUDGE_PRESETS[judgeMode].label + "：" + JUDGE_PRESETS[judgeMode].description;
  }));

  function activeJudgeWindow(baseMs) {
    return baseMs * JUDGE_PRESETS[judgeMode].multiplier;
  }

  difficultyButtons.forEach(button => button.addEventListener("click", () => {
    difficulty = button.dataset.diff;
    difficultyButtons.forEach(item => item.classList.toggle("active",item===button));
  }));

  async function loadChart() {
    const response = await fetch(CHART_URL, {cache:"no-cache"});
    if (!response.ok) throw new Error("譜面JSONを読み込めません: " + response.status);
    const data = await response.json();
    if (!data || !Number.isFinite(data.bpm) || !data.difficulties) {
      throw new Error("譜面JSONの形式が正しくありません。");
    }
    BPM = data.bpm;
    BEAT = 60 / BPM;
    return data;
  }

  function makeChart(songDuration, level) {
    const difficultyChart = chartData.difficulties[level];
    if (!difficultyChart || !Array.isArray(difficultyChart.events)) {
      throw new Error("この難易度の譜面がありません: " + level);
    }
    const patternBeats = chartData.patternBeats;
    const offset = Number(chartData.offsetSeconds || 0);
    const shift = Number(chartData.repeatLaneShift || 0);
    const chart = [];
    const repeats = Math.ceil(Math.max(0, songDuration-offset) / (patternBeats*BEAT));
    for (let repeat=0; repeat<repeats; repeat++) {
      for (const event of difficultyChart.events) {
        const t = offset + (repeat*patternBeats + event.beat)*BEAT;
        const durationBeats = event.type === "hold" ? Number(event.durationBeats) : 0;
        const endT = t + durationBeats*BEAT;
        if (t >= songDuration-0.15 || endT >= songDuration-0.05) continue;
        if (!Number.isFinite(event.beat) || !Number.isInteger(event.lane) || event.lane<0 || event.lane>3) {
          throw new Error("譜面イベントのbeat/laneが不正です。");
        }
        if (event.type !== "tap" && event.type !== "hold") {
          throw new Error("不明なノーツタイプ: " + event.type);
        }
        if (event.type === "hold" && (!Number.isFinite(durationBeats) || durationBeats<=0)) {
          throw new Error("HOLDには正のdurationBeatsが必要です。");
        }
        chart.push({
          t,
          endT,
          lane:(event.lane + repeat*shift)%4,
          type:event.type,
          done:false,
          started:false,
          startDelta:0
        });
      }
    }
    chart.sort((a,b)=>a.t-b.t || a.lane-b.lane);
    return chart;
  }

  function resetRun() {
    score=0;combo=0;maxCombo=0;
    judged={PERFECT:0,GREAT:0,GOOD:0,BAD:0,MISS:0};
    lastJudge=null;lastJudgeAt=0;
    pressed=[false,false,false,false];
    flashes=[0,0,0,0];
    activeHolds=[null,null,null,null];
  }

  async function startGame() {
    cancelAnimationFrame(raf);
    audio.pause();
    audio.currentTime=0;
    resetRun();
    notes=[];
    totalNotes=0;
    resultScreen.style.display="none";
    selectScreen.style.display="none";
    playScreen.style.display="block";
    resize();
    try { if (playScreen.requestFullscreen) playScreen.requestFullscreen().catch(()=>{}); } catch (_) {}
    try {
      chartData = await loadChart();
      const playPromise = audio.play();
      await playPromise;
      duration = Number.isFinite(audio.duration) ? audio.duration : 180;
      notes = makeChart(duration,difficulty);
      totalNotes=notes.length;
      startAt=performance.now();
      running=true;
      raf=requestAnimationFrame(gameLoop);
    } catch (error) {
      running=false;
      audio.pause();
      playScreen.style.display="none";
      selectScreen.style.display="block";
      alert("ゲームデータを読み込めませんでした。音源とchartsフォルダのJSONを確認してください。");
      console.error(error);
    }
  }

  function registerJudgement(name) {
    const result = WINDOWS.find(item=>item.name===name);
    judged[name]++;
    score += result.score;
    lastJudge=name;
    lastJudgeAt=performance.now();
    if (name==="BAD" || name==="MISS") combo=0;
    else { combo++; maxCombo=Math.max(maxCombo,combo); }
  }

  function hit(lane) {
    if (!running || activeHolds[lane]) return;
    const elapsed=(performance.now()-startAt)/1000;
    let target=null;
    let best=Infinity;
    for (const note of notes) {
      if (note.done || note.started || note.lane!==lane) continue;
      const delta=Math.abs(elapsed-note.t);
      if (delta<best) { best=delta;target=note; }
    }
    if (!target || best>activeJudgeWindow(50)/1000) return;
    target.startDelta=best*1000;
    if (target.type === "hold") {
      target.started=true;
      activeHolds[lane]=target;
      flashes[lane]=performance.now()+100;
      return;
    }
    target.done=true;
    const judgement=WINDOWS.find(item=>best*1000<=activeJudgeWindow(item.edge));
    registerJudgement(judgement.name);
    flashes[lane]=performance.now()+100;
  }

  function breakHold(lane) {
    const hold=activeHolds[lane];
    if (!hold) return;
    hold.done=true;
    hold.started=false;
    activeHolds[lane]=null;
    registerJudgement("MISS");
  }

  function missExpired(elapsed) {
    for (const note of notes) {
      if (note.done) continue;
      if (note.type === "hold" && note.started) {
        if (elapsed >= note.endT) {
          note.done=true;
          note.started=false;
          activeHolds[note.lane]=null;
          const judgement=WINDOWS.find(item=>note.startDelta<=activeJudgeWindow(item.edge));
          registerJudgement(judgement.name);
        }
      } else if (!note.started && elapsed-note.t>activeJudgeWindow(50)/1000) {
        note.done=true;
        registerJudgement("MISS");
      }
    }
  }

  function roundRect(x,y,w,h,r) {
    const radius=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+w,y,x+w,y+h,radius);
    ctx.arcTo(x+w,y+h,x,y+h,radius);
    ctx.arcTo(x,y+h,x,y,radius);
    ctx.arcTo(x,y,x+w,y,radius);
    ctx.closePath();
  }

  function draw(elapsed) {
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle="#050711";
    ctx.fillRect(0,0,width,height);
    const laneW=width/4;
    const hitY=height*0.835;
    const noteSpeed=height*0.47*speedMultiplier;
    for (let lane=0;lane<4;lane++) {
      const x=lane*laneW;
      ctx.fillStyle=lane%2===0?"#0b1120":"#0d1425";
      ctx.fillRect(x,0,laneW,height);
      ctx.fillStyle="#18233a";
      ctx.fillRect(x,0,1,height);
      ctx.fillStyle=LANE_COLORS[lane];
      ctx.globalAlpha=0.04;
      ctx.fillRect(x+2,0,laneW-4,height);
      ctx.globalAlpha=1;
      if (pressed[lane] || flashes[lane]>performance.now()) {
        ctx.fillStyle=LANE_COLORS[lane];
        ctx.globalAlpha=pressed[lane]?0.17:0.10;
        ctx.fillRect(x+2,hitY-height*0.06,laneW-4,height*0.18);
        ctx.globalAlpha=1;
      }
    }
    // faint lane guides
    for (let y=height*0.1;y<hitY;y+=height*0.1) {
      ctx.strokeStyle="#ffffff0b";
      ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();
    }
    // falling notes
    const noteH=Math.max(11,Math.min(23,height*0.022));
    for (const note of notes) {
      if (note.done) continue;
      const pad=Math.max(5,laneW*0.09);
      const x=note.lane*laneW+pad;
      const w=laneW-pad*2;
      const startY=hitY-(note.t-elapsed)*noteSpeed;
      const endY=hitY-((note.type==="hold"?note.endT:note.t)-elapsed)*noteSpeed;
      if (note.type === "hold") {
        const top=Math.max(-height,Math.min(startY,endY));
        const bottom=Math.min(hitY,Math.max(startY,endY));
        if (bottom < -noteH || top > height || bottom-top < 0) continue;
        ctx.save();
        ctx.shadowColor=LANE_COLORS[note.lane];
        ctx.shadowBlur=14;
        ctx.globalAlpha=note.started?0.55:0.82;
        ctx.fillStyle=LANE_COLORS[note.lane];
        roundRect(x+laneW*.07,top,w-laneW*.14,Math.max(noteH,bottom-top),8);
        ctx.fill();
        ctx.globalAlpha=1;
        ctx.fillStyle="#ffffff";
        roundRect(x,Math.max(-noteH,Math.min(startY-noteH/2,height)),w,noteH,noteH/2);
        ctx.fill();
        ctx.restore();
      } else {
        const y=startY-noteH/2;
        if (y < -noteH || y > height+noteH) continue;
        ctx.save();
        ctx.shadowColor=LANE_COLORS[note.lane];
        ctx.shadowBlur=12;
        const gradient=ctx.createLinearGradient(x,y,x+w,y+noteH);
        gradient.addColorStop(0,"#ffffff");
        gradient.addColorStop(.22,LANE_COLORS[note.lane]);
        gradient.addColorStop(1,LANE_COLORS[note.lane]);
        ctx.fillStyle=gradient;
        roundRect(x,y,w,noteH,noteH/2);
        ctx.fill();
        ctx.restore();
      }
    }
    // hit line and lane keycaps
    ctx.fillStyle="#eafaff";
    ctx.shadowColor="#75e4f4";
    ctx.shadowBlur=18;
    ctx.fillRect(0,hitY,width,2);
    ctx.shadowBlur=0;
    for (let lane=0;lane<4;lane++) {
      const x=lane*laneW;
      ctx.fillStyle=pressed[lane]?LANE_COLORS[lane]:"#18243a";
      roundRect(x+laneW*.2,hitY+height*.025,laneW*.6,Math.max(24,height*.042),8);
      ctx.fill();
      ctx.fillStyle=pressed[lane]?"#08111e":"#aab8d2";
      ctx.font="800 "+Math.max(12,Math.min(18,height*.019))+"px system-ui";
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(KEY_LABELS[lane],x+laneW/2,hitY+height*.046);
    }
    // minimal in-game information only
    ctx.textAlign="left";
    ctx.textBaseline="top";
    ctx.fillStyle="#a5b2cb";
    ctx.font="700 10px system-ui";
    ctx.fillText("SCORE",Math.max(16,width*.035),Math.max(16,height*.035));
    ctx.fillStyle="#f1f6ff";
    ctx.font="800 "+Math.max(18,Math.min(28,height*.033))+"px system-ui";
    ctx.fillText(score.toLocaleString("en-US"),Math.max(16,width*.035),Math.max(30,height*.055));
    ctx.textAlign="center";
    ctx.fillStyle="#9deefa";
    ctx.font="800 12px system-ui";
    ctx.fillText("HI-SPEED ×"+speedMultiplier.toFixed(1)+"  ·  "+JUDGE_PRESETS[judgeMode].label,width/2,Math.max(17,height*.035));
    if (combo>0) {
      ctx.textAlign="right";
      ctx.fillStyle="#9deefa";
      ctx.font="800 "+Math.max(22,Math.min(38,height*.045))+"px system-ui";
      ctx.fillText(combo.toLocaleString("en-US"),width-Math.max(16,width*.035),Math.max(16,height*.035));
      ctx.fillStyle="#8b9bb8";
      ctx.font="700 10px system-ui";
      ctx.fillText("COMBO",width-Math.max(16,width*.035),Math.max(48,height*.075));
    }
    if (lastJudge && performance.now()-lastJudgeAt<520) {
      const fade=1-(performance.now()-lastJudgeAt)/520;
      const item=WINDOWS.find(j=>j.name===lastJudge);
      ctx.save();
      ctx.globalAlpha=Math.max(0,fade);
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillStyle=item.color;
      ctx.shadowColor=item.color;ctx.shadowBlur=18;
      ctx.font="900 "+Math.max(24,Math.min(42,height*.052))+"px system-ui";
      ctx.fillText(lastJudge,width/2,hitY-height*.10);
      ctx.restore();
    }
  }

  function gameLoop() {
    if (!running) return;
    const elapsed=(performance.now()-startAt)/1000;
    missExpired(elapsed);
    draw(elapsed);
    if (elapsed >= duration-0.1 || notes.every(note=>note.done)) {
      finishGame();
      return;
    }
    raf=requestAnimationFrame(gameLoop);
  }

  function finishGame(aborted=false) {
    if (!running && !aborted) return;
    running=false;
    cancelAnimationFrame(raf);
    audio.pause();
    try { if (document.fullscreenElement) document.exitFullscreen().catch(()=>{}); } catch (_) {}
    if (aborted) {
      playScreen.style.display="none";
      selectScreen.style.display="block";
      return;
    }
    const theoretical=totalNotes*500;
    const ratio=theoretical>0?score/theoretical*100:0;
    const clearThreshold = {EASY:0.75,NORMAL:0.85,HARD:0.90}[judgeMode];
    const clear=theoretical>0 && score>=theoretical*clearThreshold;
    $("resultState").textContent=clear?"CLEAR":"FAILED";
    $("resultState").style.color=clear?"#83e8c1":"#ff8da7";
    $("resultScore").textContent=score.toLocaleString("en-US");
    $("resultMax").textContent="MAX "+theoretical.toLocaleString("en-US");
    $("resultRatio").textContent="THEORETICAL SCORE "+ratio.toFixed(2)+"%";
    $("resultJudges").innerHTML=["PERFECT","GREAT","GOOD","BAD","MISS"].map(name=>{
      return '<div class="judge-cell"><b>'+judged[name]+'</b><small>'+name+'</small></div>';
    }).join("");
    resultScreen.style.display="grid";
  }

  window.addEventListener("keydown",event=>{
    if (running && (event.code==="ArrowUp" || event.code==="ArrowDown")) {
      event.preventDefault();
      setSpeed(speedMultiplier + (event.code==="ArrowUp" ? 0.1 : -0.1));
      return;
    }
    if (event.code==="Escape" && running) {
      finishGame(true);
      return;
    }
    const lane=KEYS.indexOf(event.code);
    if (lane<0 || event.repeat) return;
    event.preventDefault();
    pressed[lane]=true;
    hit(lane);
  });
  window.addEventListener("keyup",event=>{
    const lane=KEYS.indexOf(event.code);
    if (lane>=0) {
      pressed[lane]=false;
      const hold=activeHolds[lane];
      if (hold) {
        const elapsed=(performance.now()-startAt)/1000;
        if (elapsed >= hold.endT) {
          hold.done=true;
          hold.started=false;
          activeHolds[lane]=null;
          const judgement=WINDOWS.find(item=>hold.startDelta<=activeJudgeWindow(item.edge));
          registerJudgement(judgement.name);
        } else {
          breakHold(lane);
        }
      }
    }
  });
  window.addEventListener("blur",()=>{
    for (let lane=0;lane<4;lane++) {
      pressed[lane]=false;
      if (activeHolds[lane]) breakHold(lane);
    }
  });

  startButton.addEventListener("click",startGame);
  $("retryButton").addEventListener("click",startGame);
  $("selectButton").addEventListener("click",()=>{
    resultScreen.style.display="none";
    playScreen.style.display="none";
    selectScreen.style.display="block";
  });
})();
