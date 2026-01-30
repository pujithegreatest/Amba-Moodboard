// ==========================================
// AMBA MUSIC TRACKER - Google Apps Script
// Deploy as Web App for the HTML interface
// ==========================================

const SPREADSHEET_ID = '1-AoBlGnCtDQfc7m_zNmS8hb4gFpelKuTqYn4XOYBEaM';
const SONGS_SHEET = 'Songs';
const MUSIC_VIDS_SHEET = 'Music Vids';

// Column indexes (0-based): A=Artist, B=Song Name, C=Link, D=Rank, E=Notes, F=Album Art URL

// Web App entry point - handles GET requests
function doGet(e) {
  if (!e || !e.parameter) {
    return jsonResponse({status: 'ok', message: 'Amba Music Tracker API'});
  }
  
  const action = e.parameter.action;
  
  if (!action) {
    return jsonResponse({status: 'ok', message: 'Amba Music Tracker API'});
  }
  
  try {
    switch(action) {
      case 'addSong':
        return handleAddSongGet(e.parameter);
      case 'getSongs':
        return handleGetSongs();
      case 'fillEmptyMetadata':
        return handleFillEmptyMetadata();
      case 'updateSong':
        return handleUpdateSong(e.parameter);
      case 'deleteSong':
        return handleDeleteSong(e.parameter);
      default:
        return jsonResponse({success: false, error: 'Unknown action'});
    }
  } catch(err) {
    return jsonResponse({success: false, error: err.toString()});
  }
}

// UPDATED: JSON response helper with CORS headers for GitHub Pages
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Get all songs from both sheets - includes album art from column F
function handleGetSongs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const songs = [];
  
  // Get songs from Songs sheet (Spotify)
  const songsSheet = ss.getSheetByName(SONGS_SHEET);
  if (songsSheet && songsSheet.getLastRow() > 1) {
    const songsData = songsSheet.getDataRange().getValues();
    for (let i = 1; i < songsData.length; i++) {
      const row = songsData[i];
      const link = row[2] ? row[2].toString().trim() : '';
      if (link) {
        songs.push({
          artist: row[0] ? row[0].toString() : '',
          songName: row[1] ? row[1].toString() : '',
          link: link,
          rank: row[3] ? row[3].toString() : '',
          notes: row[4] ? row[4].toString() : '',
          albumArt: row[5] ? row[5].toString() : '',
          rowIndex: i + 1,
          sheetName: SONGS_SHEET,
          type: 'spotify'
        });
      }
    }
  }
  
  // Get songs from Music Vids sheet (YouTube)
  const vidsSheet = ss.getSheetByName(MUSIC_VIDS_SHEET);
  if (vidsSheet && vidsSheet.getLastRow() > 1) {
    const vidsData = vidsSheet.getDataRange().getValues();
    for (let i = 1; i < vidsData.length; i++) {
      const row = vidsData[i];
      const link = row[2] ? row[2].toString().trim() : '';
      if (link) {
        songs.push({
          artist: row[0] ? row[0].toString() : '',
          songName: row[1] ? row[1].toString() : '',
          link: link,
          rank: row[3] ? row[3].toString() : '',
          notes: row[4] ? row[4].toString() : '',
          albumArt: row[5] ? row[5].toString() : '',
          rowIndex: i + 1,
          sheetName: MUSIC_VIDS_SHEET,
          type: 'youtube'
        });
      }
    }
  }
  
  return jsonResponse({success: true, songs: songs, count: songs.length});
}

// Handle addSong from GET parameters
function handleAddSongGet(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const link = params.link || '';
  const rank = params.rank || '';
  const notes = params.notes || '';
  
  if (!link) {
    return jsonResponse({success: false, error: 'No link provided'});
  }
  
  // Determine which sheet based on link type
  const isYouTube = link.includes('youtube.com') || link.includes('youtu.be');
  const sheetName = isYouTube ? MUSIC_VIDS_SHEET : SONGS_SHEET;
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return jsonResponse({success: false, error: 'Sheet "' + sheetName + '" not found'});
  }
  
  // Extract metadata from link (includes album art)
  const metadata = extractMetadata(link);
  
  // Append new row: Artist, Song Name, Link, Rank, Notes, Album Art URL
  sheet.appendRow([
    metadata.artist,
    metadata.songName,
    link,
    rank,
    notes,
    metadata.albumArt
  ]);
  
  return jsonResponse({
    success: true, 
    message: 'Song added to ' + sheetName,
    data: {
      artist: metadata.artist,
      songName: metadata.songName,
      link: link,
      rank: rank,
      notes: notes,
      albumArt: metadata.albumArt,
      sheetName: sheetName
    }
  });
}

// Fill empty metadata fields in both sheets (Artist, Song Name, Album Art)
function handleFillEmptyMetadata() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let updated = 0;
  
  const songsSheet = ss.getSheetByName(SONGS_SHEET);
  if (songsSheet) {
    updated += fillSheetMetadata(songsSheet);
  }
  
  const vidsSheet = ss.getSheetByName(MUSIC_VIDS_SHEET);
  if (vidsSheet) {
    updated += fillSheetMetadata(vidsSheet);
  }
  
  return jsonResponse({success: true, message: 'Updated ' + updated + ' cells', updated: updated});
}

// Helper to fill metadata for a single sheet
function fillSheetMetadata(sheet) {
  if (sheet.getLastRow() <= 1) return 0;
  
  const data = sheet.getDataRange().getValues();
  let updated = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const link = row[2] ? row[2].toString().trim() : '';
    const artist = row[0] ? row[0].toString().trim() : '';
    const songName = row[1] ? row[1].toString().trim() : '';
    const albumArt = row[5] ? row[5].toString().trim() : '';
    
    // Only process if link exists and something is missing
    if (link && (!artist || !songName || !albumArt)) {
      const metadata = extractMetadata(link);
      
      if (!artist && metadata.artist) {
        sheet.getRange(i + 1, 1).setValue(metadata.artist);
        updated++;
      }
      if (!songName && metadata.songName) {
        sheet.getRange(i + 1, 2).setValue(metadata.songName);
        updated++;
      }
      if (!albumArt && metadata.albumArt) {
        sheet.getRange(i + 1, 6).setValue(metadata.albumArt);
        updated++;
      }
    }
  }
  
  return updated;
}

// Extract metadata from Spotify or YouTube links
function extractMetadata(link) {
  let artist = '';
  let songName = '';
  let albumArt = '';
  
  try {
    if (link.includes('spotify.com')) {
      // Handle both track and album links
      let spotifyId = null;
      let spotifyType = 'track';
      
      const trackMatch = link.match(/track\/([a-zA-Z0-9]+)/);
      const albumMatch = link.match(/album\/([a-zA-Z0-9]+)/);
      
      if (trackMatch) {
        spotifyId = trackMatch[1];
        spotifyType = 'track';
      } else if (albumMatch) {
        spotifyId = albumMatch[1];
        spotifyType = 'album';
      }
      
      if (spotifyId) {
        // First get album art and song name from oEmbed
        const oembedUrl = 'https://open.spotify.com/oembed?url=https://open.spotify.com/' + spotifyType + '/' + spotifyId;
        const oembedResponse = UrlFetchApp.fetch(oembedUrl, {muteHttpExceptions: true});
        
        if (oembedResponse.getResponseCode() === 200) {
          const json = JSON.parse(oembedResponse.getContentText());
          albumArt = json.thumbnail_url || '';
          songName = json.title || '';
        }
        
        // Fetch the actual Spotify page to get artist from meta tags
        const pageUrl = 'https://open.spotify.com/' + spotifyType + '/' + spotifyId;
        const pageResponse = UrlFetchApp.fetch(pageUrl, {
          muteHttpExceptions: true,
          followRedirects: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (pageResponse.getResponseCode() === 200) {
          const html = pageResponse.getContentText();
          
          // Try og:description: "Artist · Song · Song · Year" format
          const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
          if (descMatch) {
            const desc = descMatch[1];
            const parts = desc.split(/\s*·\s*/);
            if (parts.length >= 2) {
              // Artist is FIRST part
              artist = parts[0].trim();
            }
          }
          
          // Fallback: title tag "Song - song and lyrics by Artist | Spotify"
          if (!artist) {
            const titleMatch = html.match(/<title>([^<]+)<\/title>/);
            if (titleMatch) {
              const byMatch = titleMatch[1].match(/by ([^|]+)\|/i);
              if (byMatch) {
                artist = byMatch[1].trim();
              }
            }
          }
        }
      }
    } else if (link.includes('youtube.com') || link.includes('youtu.be')) {
      const videoId = extractYouTubeVideoId(link);
      if (videoId) {
        const oembedUrl = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId + '&format=json';
        const response = UrlFetchApp.fetch(oembedUrl, {muteHttpExceptions: true});
        
        if (response.getResponseCode() === 200) {
          const json = JSON.parse(response.getContentText());
          songName = json.title || '';
          artist = json.author_name || '';
          // YouTube thumbnail - use maxresdefault or hqdefault
          albumArt = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
        }
      }
    }
  } catch(e) {
    Logger.log('Error extracting metadata: ' + e.toString());
  }
  
  return {artist: artist, songName: songName, albumArt: albumArt};
}

// Extract YouTube video ID from URL
function extractYouTubeVideoId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Update song (rank and notes only)
function handleUpdateSong(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rowIndex = parseInt(params.rowIndex);
  const sheetName = params.sheetName;
  const rank = params.rank || '';
  const notes = params.notes || '';
  
  if (!rowIndex || !sheetName) {
    return jsonResponse({success: false, error: 'Missing rowIndex or sheetName'});
  }
  
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return jsonResponse({success: false, error: 'Sheet not found'});
  }
  
  // Update rank (column D = 4) and notes (column E = 5)
  sheet.getRange(rowIndex, 4).setValue(rank);
  sheet.getRange(rowIndex, 5).setValue(notes);
  
  return jsonResponse({success: true, message: 'Song updated'});
}

// Delete song
function handleDeleteSong(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rowIndex = parseInt(params.rowIndex);
  const sheetName = params.sheetName;
  
  if (!rowIndex || !sheetName) {
    return jsonResponse({success: false, error: 'Missing rowIndex or sheetName'});
  }
  
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return jsonResponse({success: false, error: 'Sheet not found'});
  }
  
  // Delete the entire row
  sheet.deleteRow(rowIndex);
  
  return jsonResponse({success: true, message: 'Song deleted'});
}

// ==========================================
// TEST & MANUAL FUNCTIONS
// ==========================================

// DEBUG: Test what Spotify page returns for artist
function testSpotifyOembed() {
  const trackId = '4trUYyno0kNeZ6tLZzvd8f';
  
  // Test page fetch
  const pageUrl = 'https://open.spotify.com/track/' + trackId;
  const pageResponse = UrlFetchApp.fetch(pageUrl, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  Logger.log('Page status: ' + pageResponse.getResponseCode());
  
  const html = pageResponse.getContentText();
  
  // Check og:description
  const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
  Logger.log('og:description: ' + (descMatch ? descMatch[1] : 'NOT FOUND'));
  
  // Check twitter:audio:artist_name
  const artistMatch = html.match(/<meta name="twitter:audio:artist_name" content="([^"]+)"/);
  Logger.log('twitter:audio:artist_name: ' + (artistMatch ? artistMatch[1] : 'NOT FOUND'));
  
  // Check title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  Logger.log('title: ' + (titleMatch ? titleMatch[1] : 'NOT FOUND'));
  
  // Test full extraction
  const metadata = extractMetadata('https://open.spotify.com/track/' + trackId);
  Logger.log('=== EXTRACTED METADATA ===');
  Logger.log('artist: ' + metadata.artist);
  Logger.log('songName: ' + metadata.songName);
  Logger.log('albumArt: ' + metadata.albumArt);
}

function testGetSongs() {
  const result = handleGetSongs();
  Logger.log(result.getContent());
}

function testFillMetadata() {
  const result = handleFillEmptyMetadata();
  Logger.log(result.getContent());
}

// Run this to fill all empty metadata (can be triggered manually or on schedule)
function fillAllMetadata() {
  const result = handleFillEmptyMetadata();
  Logger.log(result.getContent());
}