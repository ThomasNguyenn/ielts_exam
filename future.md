# Future Roadmap: LearnReact (IELTS Platform)

This document outlines potential future enhancements for the platform, categorized by impactful areas.

## 1. Speaking Module Enhancements (AI-Driven)

### Interactive Audio Transcript (Sync & Highlight)
*   **Enhancement**: Sync audio playback with text (Karaoke style).
*   **Benefits**: Helps users pinpoint errors by clicking on AI feedback.
*   **Tech**: Web Speech API or timestamps from Whisper/Google STT.

### Pronunciation Visualization (Pitch & Intonation)
*   **Enhancement**: Visual waveform comparison between user and native model.
*   **Benefits**: Visualize intonation (rising/falling tones) crucial for Band 7+.
*   **Tech**: `wavesurfer.js` + TTS model waveform overlay.

### AI Mock Examiner (Conversational Mode)
*   **Enhancement**: Multi-turn dialogue where AI asks follow-up questions based on user answers.
*   **Benefits**: Simulates real exam pressure (Part 3 handling).

### "Shadowing" Exercises
*   **Enhancement**: Listen to a Band 9.0 model answer and record immediately to mimic intonation.
*   **Benefits**: Proven method for improving accent and fluency.

### Gamified Streaks & Drills
*   **Enhancement**: Personalized mini-games for specific phonemes (e.g., "th" vs "s").

## 2. Whole Website Enhancements (System-Wide)

### 🧠 Smart Study Planner (The "GPS" for IELTS)
*   **Feature**: Dynamic daily schedule based on exam date and current band score.
*   **Logic**: "You have 30 days. Today: Read 1 Passage + Learn 20 Words."
*   **Adaptability**: Automatically adjusts if a user misses a day.

### 📊 Deep Analytics Dashboard
*   **Radar Chart**: Visual breakdown of skills (Reading vs Listening vs Writing vs Speaking).
*   **Weakness Detective**: Pinpoint specific weakness types (e.g., "You fail 60% of 'True/False/Not Given' questions").
*   **Progress Tracking**: Line graph showing Band Score improvement over time.

### 🌍 Community & Social
*   **Writing Peer Review**: Anonymously review other users' essays for XP (Moderated by AI).
*   **Vocabulary Battles**: Real-time 1v1 vocabulary quizzes against friends or random opponents.
*   **Leaderboards**: Weekly top learners to drive retention.

### 📱 Mobile Experience (PWA)
*   **Feature**: Fully responsive design for mobile + "Add to Home Screen" capability.
*   **Offline Mode**: Enable Vocabulary review without internet access.

### 📰 Content Ecosystem
*   **Daily News for IELTS**: AI automatically scrapes news and simplifies it to IELTS Reading passage level.
*   **Podcast Player**: Integrated listening practice with interactive transcripts.

## 3. Technical & Monetization

### Browser Extension Companion
*   **Feature**: Double-click any word on the web to add it to LearnReact flashcards.

### Live Tutoring Integration
*   **Feature**: Booking system for 1-on-1 sessions with human tutors for high-tier users.