import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import Cookies from "js-cookie";

export default function App() {
  const [keyEntered, setKeyEntered] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [correctKey, setCorrectKey] = useState(null);

  useEffect(() => {
    const fetchKey = async () => {
      try {
        const response = await fetch("https://raw.githubusercontent.com/MrEuwn/mcgogov2/main/key", {
          cache: "no-store", // Ensure the request bypasses any cache
        });
        if (!response.ok) {
          throw new Error("Failed to fetch key");
        }
        const key = await response.text();
        const trimmedKey = key.trim(); // Ensure the key is trimmed

        // Update the cookie with the latest key
        Cookies.set("accessKey", trimmedKey, { expires: 1 });

        // Log the fetched key and the cookie value for debugging
        console.log("Fetched key on load:", trimmedKey);
        console.log("Cookie value on load:", Cookies.get("accessKey"));

        setCorrectKey(trimmedKey);
      } catch (error) {
        console.error("Error fetching key on load:", error);
        alert("Failed to fetch the access key. Please check your connection or try again later.");
      }
    };

    fetchKey();
  }, []);

  const handleKeySubmit = async () => {
    try {
      const response = await fetch("https://raw.githubusercontent.com/MrEuwn/mcgogov2/main/key", {
        cache: "no-store", // Ensure the request bypasses any cache
      });
      if (!response.ok) {
        throw new Error("Failed to fetch key");
      }
      const key = await response.text();
      const trimmedKey = key.trim(); // Ensure the key is trimmed

      // Update the cookie with the latest key
      Cookies.set("accessKey", trimmedKey, { expires: 1 });

      // Log the fetched key and the cookie value for debugging
      console.log("Fetched key:", trimmedKey);
      console.log("Cookie value:", Cookies.get("accessKey"));

      if (keyInput === trimmedKey) {
        setKeyEntered(true);
      } else {
        alert("Invalid key. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching key:", error);
      alert("Failed to fetch the access key. Please check your connection or try again later.");
    }
  };

  // --- Input state ---
  const [inputPlayers, setInputPlayers] = useState(["", "", "", "", "", "", ""]);
  const [players, setPlayers] = useState([]);
  const [namesConfirmed, setNamesConfirmed] = useState(false);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  // Rotation engine state
  const [sequence, setSequence] = useState([]); // array of { id, type, name }
  const [idx, setIdx] = useState(0); // points to next slot to evaluate
  const [koList, setKoList] = useState([]);
  const [nextLabel, setNextLabel] = useState(null);
  const [rotationStarted, setRotationStarted] = useState(false);

  // helpers
  const updateName = (i, v) => {
    const copy = [...inputPlayers];
    copy[i] = v;
    setInputPlayers(copy);
  };

  const confirmNames = () => {
    const filtered = inputPlayers.map(s => s.trim()).filter(Boolean);
    if (filtered.length < 7) {
      alert("Minimal 7 nama harus diisi.");
      return;
    }
    setPlayers(filtered);
    setNamesConfirmed(true);
  };

  // sequence generator according to rules
  const generateSequence = (pls, maxSlots = 200) => {
    if (!pls || pls.length < 1) return [];
    const seq = [];
    // patterns
    const babak1Pattern = ["creep", "enemy", "enemy", "enemy", "fatebox"]; // 1.1-1.5
    const babakNPattern = ["enemy", "enemy", "creep", "enemy", "enemy", "enemy", "fatebox"]; // 2.1-2.7 and onwards

    let playerIdx = 0; // index into pls; first enemy encountered should be players[0] for 1.2
    let babak = 1;

    while (seq.length < maxSlots) {
      const pattern = babak === 1 ? babak1Pattern : babakNPattern;
      for (let s = 0; s < pattern.length && seq.length < maxSlots; s++) {
        const slotType = pattern[s];
        const roundId = `${babak}.${s + 1}`;
        if (slotType === "enemy") {
          // assign current player
          const name = pls[playerIdx % pls.length];
          seq.push({ id: roundId, type: "enemy", name });
          playerIdx = (playerIdx + 1) % pls.length;
        } else if (slotType === "creep") {
          seq.push({ id: roundId, type: "creep", name: null });
        } else if (slotType === "fatebox") {
          seq.push({ id: roundId, type: "fatebox", name: null });
        }
      }
      babak++;
    }

    return seq;
  };

  // compute candidate at given index (skip KO for enemies)
  const computeCandidateAt = (startIndex, currentSequence, currentKo) => {
    if (!currentSequence || currentSequence.length === 0) return { label: null, nextIndex: startIndex };
    let attempts = 0;
    let i = startIndex % currentSequence.length;
    while (attempts < currentSequence.length) {
      const entry = currentSequence[i];
      if (entry.type === "creep") return { label: `${entry.id} — Creep (Monster)`, nextIndex: (i + 1) % currentSequence.length };
      if (entry.type === "fatebox") return { label: `${entry.id} — Fatebox`, nextIndex: (i + 1) % currentSequence.length };
      // enemy
      if (!currentKo.includes(entry.name)) {
        return { label: `${entry.id} — ${entry.name}`, nextIndex: (i + 1) % currentSequence.length };
      }
      i = (i + 1) % currentSequence.length;
      attempts++;
    }
    return { label: "Tidak ada lawan", nextIndex: startIndex };
  };

  // automatically start rotation when names confirmed: build sequence and jump to 2.6
  const handleConfirm = () => {
    confirmNames();
    const filtered = inputPlayers.map(s => s.trim()).filter(Boolean);
    const seq = generateSequence(filtered, 500);
    setSequence(seq);
    // find index of 2.6
    const startAt = seq.findIndex(e => e.id === "2.6");
    const startIndex = startAt >= 0 ? startAt : 0;
    const cand = computeCandidateAt(startIndex, seq, []);
    setIdx(cand.nextIndex); // next pointer moves after the chosen slot
    setNextLabel(cand.label);
    setKoList([]);
    setRotationStarted(true);
    setPlayers(filtered);
    setNamesConfirmed(true);
  };

  const toggleKO = (name) => {
    setKoList(prev => {
      const updated = prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name];
      // after KO change, if current nextLabel points to a KO, advance to next available
      setTimeout(() => {
        const curIdx = idx % sequence.length;
        const cand = computeCandidateAt(curIdx, sequence, updated);
        setNextLabel(cand.label);
        setIdx(cand.nextIndex);
      }, 0);
      return updated;
    });
  };

  // advance to next slot manually
  const handleNext = () => {
    if (!rotationStarted || !sequence.length) return;
    const cand = computeCandidateAt(idx % sequence.length, sequence, koList);
    setNextLabel(cand.label);
    setIdx(cand.nextIndex);
  };

  // upcoming preview without mutating idx
  const upcomingPreview = useMemo(() => {
    if (!sequence.length) return null;
    const cand = computeCandidateAt(idx % sequence.length, sequence, koList);
    return cand.label;
  }, [sequence, idx, koList]);

  const resetAll = () => {
    setInputPlayers(["", "", "", "", "", "", ""]);
    setPlayers([]);
    setNamesConfirmed(false);
    setSequence([]);
    setIdx(0);
    setKoList([]);
    setNextLabel(null);
    setRotationStarted(false);
  };

  const resetToNameInput = () => {
    setInputPlayers(["", "", "", "", "", "", ""]);
    setPlayers([]);
    setNamesConfirmed(false);
    setSequence([]);
    setIdx(0);
    setKoList([]);
    setNextLabel(null);
    setRotationStarted(false);
    setCurrentPlayerIndex(0);
  };

  const handlePlayerNameSubmit = () => {
    if (currentPlayerIndex < 6) {
      setCurrentPlayerIndex(currentPlayerIndex + 1);
    } else {
      // Prediction logic after all names are entered
      const filtered = inputPlayers.map(name => name.trim()).filter(Boolean);
      if (filtered.length < 7) {
        alert("Minimal 7 nama harus diisi.");
        return;
      }
      setPlayers(filtered);
      setNamesConfirmed(true);
      const seq = generateSequence(filtered, 500);
      setSequence(seq);
      const startAt = seq.findIndex(e => e.id === "2.6");
      const startIndex = startAt >= 0 ? startAt : 0;
      const cand = computeCandidateAt(startIndex, seq, []);
      setIdx(cand.nextIndex);
      setNextLabel(cand.label);
      setKoList([]);
      setRotationStarted(true);
    }
  };

  if (correctKey === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 flex items-center justify-center p-6">
        <div className="bg-white/6 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!keyEntered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 flex items-center justify-center p-6">
        <div className="bg-white/6 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-4">Enter Access Key</h1>
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Enter key"
            className="w-full p-3 rounded-md bg-white/10 text-white placeholder-white/50 focus:outline-none"
          />
          <button
            onClick={handleKeySubmit}
            className="mt-4 w-full p-3 bg-green-500 text-white rounded-md font-semibold"
          >
            Submit
          </button>
          <a
            href="https://link-center.net/1457518/gU0z4qcB00hg"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-4 text-center text-blue-300 hover:underline"
          >
            Doesn't have key? get it here !
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-blue-500 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="bg-white/6 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-3xl w-full border border-white/10"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-4">Magic Chess Match Predictor</h1>

        {!namesConfirmed ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-lg text-white mb-3 text-center">
              Enter name for Player {currentPlayerIndex + 1}
            </h2>
            <input
              type="text"
              value={inputPlayers[currentPlayerIndex]}
              onChange={e => updateName(currentPlayerIndex, e.target.value)}
              placeholder={`Player ${currentPlayerIndex + 1} Name`}
              className="w-full p-3 rounded-md bg-white/10 text-white placeholder-white/50 focus:outline-none"
            />
            <div className="flex gap-2 mt-4">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handlePlayerNameSubmit}
                className="mt-4 w-full p-3 bg-green-500 text-white rounded-md font-semibold"
              >
                {currentPlayerIndex < 6 ? "Next" : "Predict!"}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* Center big card layout B */}
            <div className="flex flex-col items-center">
              <motion.div initial={{ scale: 0.98 }} animate={{ scale: 1 }} className="w-full max-w-full sm:max-w-xl bg-white/6 p-6 rounded-2xl text-center">
                <div className="text-sm text-white/70 mb-2">Lawan Selanjutnya</div>
                <motion.div
                  key={nextLabel}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl sm:text-3xl text-white font-extrabold mb-4"
                >
                  {nextLabel ?? upcomingPreview ?? "-"}
                </motion.div>
                <div className="flex justify-center gap-3">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleNext} className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold">Next</motion.button>
                </div>
              </motion.div>

              {/* KO buttons */}
              <div className="w-full max-w-full sm:max-w-xl mt-4">
                <div className="text-white/90 mb-2">Tandai KO (klik untuk toggle)</div>
                <div className="flex flex-wrap gap-2">
                  {players.map(p => (
                    <button key={p} onClick={() => toggleKO(p)} className={`px-3 py-1 rounded-md font-medium ${koList.includes(p) ? "bg-red-600 text-white" : "bg-white/10 text-white"}`}>
                      {p}{koList.includes(p) ? " (KO)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rotation preview list */}
              <div className="w-full max-w-full sm:max-w-xl mt-4 bg-white/10 rounded-md p-4">
                <div className="text-white/80 mb-2">Preview Urutan (bagian awal)</div>
                <ol className="list-decimal list-inside text-white/90 space-y-1">
                  {sequence.slice(0, 24).map((s, i) => (
                    <li key={i} className={`${s.type === "creep" ? "italic text-white/70" : ""}`}>{s.type === "creep" ? `${s.id} — Creep (Monster)` : (s.type === "fatebox" ? `${s.id} — Fatebox` : `${s.id} — ${s.name}${koList.includes(s.name) ? " (KO)" : ""}`)}</li>
                  ))}
                </ol>
              </div>

              <div className="flex justify-center mt-4">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={resetToNameInput}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold"
                >
                  Predict Again
                </motion.button>
              </div>

              <div className="mt-4 text-sm text-white/70">{namesConfirmed ? "Nama pemain terdaftar: " + players.join(", ") : "Belum ada pemain"}</div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

