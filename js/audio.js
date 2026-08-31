/*
 * audio.js — a small generative ambient score, synthesized entirely in the
 * browser with Tone.js. No audio files to host; every listen is slightly
 * different. Must be started from a user gesture (browser autoplay rules).
 */

const AUDIO = (() => {
  let started = false;
  let master, pad, bass, pluck;

  // Loose, non-resolving add9 voicings — deliberately never "lands" on a
  // tonic, to keep the mood suspended and weightless.
  const chords = [
    ['C3', 'G3', 'D4', 'A4'],
    ['A2', 'E3', 'B3', 'F#4'],
    ['F3', 'C4', 'G4', 'D5'],
    ['D3', 'A3', 'E4', 'B4']
  ];
  let idx = 0;

  function build() {
    Tone.Transport.bpm.value = 56;

    master = new Tone.Gain(0).toDestination();
    const filter = new Tone.Filter({ frequency: 1100, type: 'lowpass', rolloff: -12 }).connect(master);
    const padDelay = new Tone.FeedbackDelay({ delayTime: '4n.', feedback: 0.35, wet: 0.3 }).connect(filter);

    pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 4, decay: 3, sustain: 0.7, release: 9 },
      volume: -13
    }).connect(padDelay);

    bass = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 5, decay: 2, sustain: 1, release: 9 },
      volume: -18
    }).connect(filter);

    const pluckDelay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.42, wet: 0.5 }).connect(master);
    pluck = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 1.3, sustain: 0, release: 2 },
      volume: -24
    }).connect(pluckDelay);

    new Tone.Loop((time) => {
      const chord = chords[idx % chords.length];
      pad.triggerAttackRelease(chord, '4m', time);
      bass.triggerAttackRelease(chord[0], '4m', time);
      idx++;
    }, '8m').start(0);

    new Tone.Loop((time) => {
      if (Math.random() < 0.5) {
        const chord = chords[idx % chords.length];
        const note = chord[Math.floor(Math.random() * chord.length)];
        const transposed = Tone.Frequency(note).transpose(Math.random() < 0.5 ? 12 : 24);
        pluck.triggerAttackRelease(transposed, '8n', time + Math.random() * 0.6);
      }
    }, '1m').start('4m');

    Tone.Transport.start();
  }

  return {
    async init() {
      if (started) return;
      await Tone.start();
      build();
      started = true;
    },
    setEnabled(on) {
      if (!started || !master) return;
      master.gain.cancelScheduledValues(Tone.now());
      master.gain.rampTo(on ? 0.85 : 0, 1.3);
    },
    isStarted() { return started; }
  };
})();
