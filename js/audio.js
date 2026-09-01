/*
 * audio.js — a small generative score, synthesized entirely in the browser
 * with Tone.js. No audio files to host; every listen is slightly different.
 * Must be started from a user gesture (browser autoplay rules).
 *
 * v2: warmer pad (triangle instead of sine, tighter delay feedback so it
 * doesn't smear into dissonance), a steadier consonant progression that
 * actually resolves, and a soft pulsing arpeggio layer for forward motion —
 * less "horror ambient", more "hopeful sci-fi drift".
 */

const AUDIO = (() => {
  let started = false;
  let master, pad, bass, pluck, arp;

  // A warmer, resolving progression (I - vi - IV - V in C) instead of the
  // old suspended, never-landing voicings.
  const chords = [
    ['C3', 'E3', 'G3', 'B3', 'D4'],   // Cmaj9
    ['A2', 'C3', 'E3', 'G3', 'B3'],   // Am9
    ['F2', 'A2', 'C3', 'E3', 'G3'],   // Fmaj9
    ['G2', 'B2', 'D3', 'F#3', 'A3']   // G9 - pulls gently back toward C
  ];
  let idx = 0;

  function build() {
    Tone.Transport.bpm.value = 74;

    master = new Tone.Gain(0).toDestination();
    const filter = new Tone.Filter({ frequency: 1500, type: 'lowpass', rolloff: -12 }).connect(master);
    const padDelay = new Tone.FeedbackDelay({ delayTime: '4n.', feedback: 0.24, wet: 0.22 }).connect(filter);

    pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 3, decay: 2, sustain: 0.75, release: 6 },
      volume: -11
    }).connect(padDelay);

    bass = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 2.5, decay: 1.5, sustain: 1, release: 6 },
      volume: -15
    }).connect(filter);

    const arpPanner = new Tone.AutoPanner({ frequency: 0.09, depth: 0.6 }).connect(master).start();
    const arpDelay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.22, wet: 0.28 }).connect(arpPanner);
    arp = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.05, release: 0.6 },
      volume: -20
    }).connect(arpDelay);

    const pluckDelay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.3, wet: 0.35 }).connect(master);
    pluck = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 1.1, sustain: 0, release: 1.6 },
      volume: -22
    }).connect(pluckDelay);

    // Slow pad + bass progression - the harmonic bed.
    new Tone.Loop((time) => {
      const chord = chords[idx % chords.length];
      pad.triggerAttackRelease(chord, '4m', time);
      bass.triggerAttackRelease(chord[0], '4m', time);
      idx++;
    }, '8m').start(0);

    // Steady quarter-note arpeggio through the current chord - this is the
    // "energy"/forward-motion layer that was missing before.
    let step = 0;
    new Tone.Loop((time) => {
      const chord = chords[(idx > 0 ? idx - 1 : 0) % chords.length];
      const note = chord[step % chord.length];
      arp.triggerAttackRelease(Tone.Frequency(note).transpose(12), '8n', time);
      step++;
    }, '4n').start('2m');

    // Sparse high plucks for sparkle.
    new Tone.Loop((time) => {
      if (Math.random() < 0.45) {
        const chord = chords[idx % chords.length];
        const note = chord[Math.floor(Math.random() * chord.length)];
        pluck.triggerAttackRelease(Tone.Frequency(note).transpose(24), '8n', time + Math.random() * 0.4);
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
      master.gain.rampTo(on ? 0.8 : 0, 1.2);
    },
    isStarted() { return started; }
  };
})();
