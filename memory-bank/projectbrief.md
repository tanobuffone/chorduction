# Project Brief: Chorduction

## Overview
Chorduction is a Spicetify extension for real-time chord detection, lyrics synchronization, and music analysis. It provides musicians with tools to understand and learn songs directly within Spotify.

## Core Goals
1. **Chord Detection**: Identify chords in real-time using audio analysis
2. **Lyrics Sync**: Display time-synchronized lyrics alongside chords
3. **Learning Tools**: Transpose, notations, fretboard diagrams
4. **Export**: Save chord progressions in multiple formats

## Target Users
- Musicians learning new songs
- Music students studying harmony
- Songwriters analyzing progressions
- Karaoke enthusiasts

## Key Features
- Real-time chord detection via Spotify Audio Analysis API
- Krumhansl-Schmuckler key detection
- Multiple chord notation systems (Standard, Nashville, Solfege, Roman)
- Transposing (±12 semitones)
- Export to TXT, JSON, ChordPro
- Guitar fretboard diagrams
- Synced lyrics from LRCLIB/Spotify

## Technical Constraints
- Must work as Spicetify extension
- Spotify API rate limits (graceful degradation required)
- CORS limitations in web player
- No external dependencies (vanilla JS only)

## Success Metrics
- Accurate chord detection (>70% confidence typical)
- Fast analysis (<3 seconds per track)
- Zero crashes with proper error handling
- User adoption via Spicetify Marketplace