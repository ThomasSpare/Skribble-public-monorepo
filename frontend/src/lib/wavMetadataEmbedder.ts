export interface AudioAnnotation {
  id: string;
  timestamp: number; // in seconds
  text: string;
  type: string;
  priority: string;
  user: string;
}

export class WAVMetadataEmbedder {
  
  /**
   * Embed annotations as cue points directly into WAV file
   */
  static async embedAnnotationsInWAV(
    audioUrl: string,
    annotations: AudioAnnotation[],
    projectTitle: string
  ): Promise<Blob> {
    console.log(`Embedding ${annotations.length} annotations into WAV file...`);
    
    try {
      // Fetch the original audio file
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status}`);
      }
      
      const originalBuffer = await response.arrayBuffer();
      const originalBytes = new Uint8Array(originalBuffer);
      
      // Parse WAV file structure
      const wavData = this.parseWAVFile(originalBytes);
      if (!wavData) {
        throw new Error('Invalid WAV file format');
      }
      
      console.log('WAV file parsed:', wavData);
      
      // Create cue chunk with annotation positions
      const cueChunk = this.createCueChunk(annotations, wavData.sampleRate);
      
      // Create associated data list chunk with annotation text
      const adtlChunk = this.createAdtlChunk(annotations);
      
      // Rebuild WAV file with embedded metadata
      const newWavBytes = this.rebuildWAVWithMetadata(
        originalBytes,
        wavData,
        cueChunk,
        adtlChunk
      );
      
      console.log(`WAV file rebuilt with ${annotations.length} cue points`);
      return new Blob([newWavBytes], { type: 'audio/wav' });
      
    } catch (error) {
      console.error('Error embedding annotations in WAV:', error);
      throw error;
    }
  }
  
  /**
   * Parse WAV file to extract essential information
   */
  static parseWAVFile(bytes: Uint8Array): {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    dataChunkStart: number;
    dataChunkSize: number;
  } | null {
    try {
      if (bytes.length < 44) {
        throw new Error('File too small to be a valid WAV');
      }
      
      // Check RIFF header
      const riffHeader = String.fromCharCode(...bytes.slice(0, 4));
      if (riffHeader !== 'RIFF') {
        throw new Error('Not a valid RIFF file');
      }
      
      // Check WAV format
      const waveHeader = String.fromCharCode(...bytes.slice(8, 12));
      if (waveHeader !== 'WAVE') {
        throw new Error('Not a valid WAV file');
      }
      
      // Parse format chunk
      const sampleRate = this.readLittleEndian32(bytes, 24);
      const channels = this.readLittleEndian16(bytes, 22);
      const bitsPerSample = this.readLittleEndian16(bytes, 34);
      
      // Find data chunk
      let offset = 12;
      let dataChunkStart = 0;
      let dataChunkSize = 0;
      
      while (offset < bytes.length - 8) {
        const chunkId = String.fromCharCode(...bytes.slice(offset, offset + 4));
        const chunkSize = this.readLittleEndian32(bytes, offset + 4);
        
        if (chunkId === 'data') {
          dataChunkStart = offset;
          dataChunkSize = chunkSize;
          break;
        }
        
        offset += 8 + chunkSize;
        // Align to even boundary
        if (offset % 2 !== 0) offset++;
      }
      
      if (dataChunkStart === 0) {
        throw new Error('No data chunk found in WAV file');
      }
      
      return {
        sampleRate,
        channels,
        bitsPerSample,
        dataChunkStart,
        dataChunkSize
      };
      
    } catch (error) {
      console.error('Error parsing WAV file:', error);
      return null;
    }
  }
  
  /**
   * Create WAV cue chunk with annotation positions
   */
  static createCueChunk(annotations: AudioAnnotation[], sampleRate: number): Uint8Array {
    const buffer = new ArrayBuffer(4 + (annotations.length * 24)); // 4 bytes for count + 24 bytes per cue point
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    
    let offset = 0;
    
    // Number of cue points (4 bytes, little endian)
    view.setUint32(offset, annotations.length, true);
    offset += 4;
    
    // Cue point data (24 bytes each)
    annotations.forEach((annotation, index) => {
      const samplePosition = Math.round(annotation.timestamp * sampleRate);
      const cueId = index + 1;
      
      // Cue point ID (4 bytes)
      view.setUint32(offset, cueId, true);
      offset += 4;
      
      // Position (4 bytes) - sample number
      view.setUint32(offset, samplePosition, true);
      offset += 4;
      
      // Data chunk identifier (4 bytes) - 'data'
      bytes[offset] = 0x64; // 'd'
      bytes[offset + 1] = 0x61; // 'a'
      bytes[offset + 2] = 0x74; // 't'
      bytes[offset + 3] = 0x61; // 'a'
      offset += 4;
      
      // Chunk start (4 bytes) - usually 0
      view.setUint32(offset, 0, true);
      offset += 4;
      
      // Block start (4 bytes) - usually 0
      view.setUint32(offset, 0, true);
      offset += 4;
      
      // Sample offset (4 bytes) - same as position
      view.setUint32(offset, samplePosition, true);
      offset += 4;
    });
    
    return bytes;
  }
  
  /**
   * Create associated data list chunk with annotation text
   */
  static createAdtlChunk(annotations: AudioAnnotation[]): Uint8Array {
    const chunks: Uint8Array[] = [];
    
    annotations.forEach((annotation, index) => {
      const cueId = index + 1;
      
      // Format annotation text with metadata
      const enhancedText = this.formatAnnotationText(annotation);
      const textBytes = new TextEncoder().encode(enhancedText);
      
      // Create 'labl' subchunk
      const labelSize = 4 + textBytes.length + 1; // 4 bytes for cue ID + text + null terminator
      const paddedSize = labelSize + (labelSize % 2); // Pad to even length
      
      const labelBuffer = new ArrayBuffer(8 + paddedSize); // 8 bytes header + data
      const labelView = new DataView(labelBuffer);
      const labelBytes = new Uint8Array(labelBuffer);
      
      let offset = 0;
      
      // 'labl' chunk identifier (4 bytes)
      labelBytes[offset] = 0x6C; // 'l'
      labelBytes[offset + 1] = 0x61; // 'a'
      labelBytes[offset + 2] = 0x62; // 'b'
      labelBytes[offset + 3] = 0x6C; // 'l'
      offset += 4;
      
      // Chunk size (4 bytes)
      labelView.setUint32(offset, paddedSize, true);
      offset += 4;
      
      // Cue point ID (4 bytes)
      labelView.setUint32(offset, cueId, true);
      offset += 4;
      
      // Label text
      labelBytes.set(textBytes, offset);
      offset += textBytes.length;
      
      // Null terminator
      labelBytes[offset] = 0;
      offset++;
      
      // Padding byte if needed
      if (labelSize % 2 !== 0) {
        labelBytes[offset] = 0;
      }
      
      chunks.push(labelBytes);
    });
    
    // Combine all label chunks
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    
    chunks.forEach(chunk => {
      result.set(chunk, offset);
      offset += chunk.length;
    });
    
    return result;
  }
  
  /**
   * Format annotation text with additional metadata
   */
  static formatAnnotationText(annotation: AudioAnnotation): string {
    const typeIcon = this.getAnnotationIcon(annotation.type);
    const priorityIcon = this.getPriorityIcon(annotation.priority);
    
    return `${priorityIcon}${typeIcon} ${annotation.user}: ${annotation.text}`;
  }
  
  /**
   * Get icon for annotation type
   */
  static getAnnotationIcon(type: string): string {
    switch (type) {
      case 'issue': return '⚠️ ';
      case 'approval': return '✅ ';
      case 'marker': return '📍 ';
      case 'section': return '🎵 ';
      case 'voice': return '🎤 ';
      default: return '💬 ';
    }
  }
  
  /**
   * Get icon for priority level
   */
  static getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'critical': return '🔥 ';
      case 'high': return '⚡ ';
      case 'medium': return '';
      case 'low': return '';
      default: return '';
    }
  }
  
  /**
   * Rebuild WAV file with new metadata chunks
   */
  static rebuildWAVWithMetadata(
    originalBytes: Uint8Array,
    wavData: { dataChunkStart: number; dataChunkSize: number },
    cueChunk: Uint8Array,
    adtlChunk: Uint8Array
  ): Uint8Array {
    
    // Calculate new file size
    const originalDataEnd = wavData.dataChunkStart + 8 + wavData.dataChunkSize;
    const cueChunkSize = cueChunk.length > 0 ? 8 + cueChunk.length : 0; // 8 bytes header + data
    const listChunkSize = adtlChunk.length > 0 ? 8 + 4 + adtlChunk.length : 0; // 8 bytes header + 'adtl' + data
    
    const newFileSize = originalDataEnd + cueChunkSize + listChunkSize;
    const newBytes = new Uint8Array(newFileSize);
    const newView = new DataView(newBytes.buffer);
    
    let offset = 0;
    
    // Copy original file up to end of data chunk
    newBytes.set(originalBytes.slice(0, originalDataEnd), 0);
    offset = originalDataEnd;
    
    // Add cue chunk if we have annotations
    if (cueChunk.length > 0) {
      // 'cue ' chunk header
      newBytes[offset] = 0x63; // 'c'
      newBytes[offset + 1] = 0x75; // 'u'
      newBytes[offset + 2] = 0x65; // 'e'
      newBytes[offset + 3] = 0x20; // ' '
      offset += 4;
      
      // Chunk size
      newView.setUint32(offset, cueChunk.length, true);
      offset += 4;
      
      // Chunk data
      newBytes.set(cueChunk, offset);
      offset += cueChunk.length;
    }
    
    // Add LIST chunk with associated data
    if (adtlChunk.length > 0) {
      // 'LIST' chunk header
      newBytes[offset] = 0x4C; // 'L'
      newBytes[offset + 1] = 0x49; // 'I'
      newBytes[offset + 2] = 0x53; // 'S'
      newBytes[offset + 3] = 0x54; // 'T'
      offset += 4;
      
      // Chunk size (4 bytes for 'adtl' + data)
      newView.setUint32(offset, 4 + adtlChunk.length, true);
      offset += 4;
      
      // 'adtl' list type
      newBytes[offset] = 0x61; // 'a'
      newBytes[offset + 1] = 0x64; // 'd'
      newBytes[offset + 2] = 0x74; // 't'
      newBytes[offset + 3] = 0x6C; // 'l'
      offset += 4;
      
      // Associated data
      newBytes.set(adtlChunk, offset);
      offset += adtlChunk.length;
    }
    
    // Update file size in RIFF header (bytes 4-7)
    const totalFileSize = newFileSize - 8; // Exclude RIFF header itself
    newView.setUint32(4, totalFileSize, true);
    
    console.log(`WAV file rebuilt: ${originalBytes.length} -> ${newFileSize} bytes`);
    console.log(`Added ${cueChunk.length > 0 ? 'cue chunk' : 'no cue chunk'}`);
    console.log(`Added ${adtlChunk.length > 0 ? 'adtl chunk' : 'no adtl chunk'}`);
    
    return newBytes;
  }
  
  /**
   * Helper function to read 16-bit little-endian integer
   */
  static readLittleEndian16(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }
  
  /**
   * Helper function to read 32-bit little-endian integer
   */
  static readLittleEndian32(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | 
           (bytes[offset + 1] << 8) | 
           (bytes[offset + 2] << 16) | 
           (bytes[offset + 3] << 24);
  }
  
  /**
   * Download the embedded WAV file
   */
  static downloadEmbeddedWAV(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.wav') ? filename : `${filename}.wav`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up the URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

/**
 * Main export function for embedding annotations in WAV files
 */
export async function exportWAVWithEmbeddedAnnotations(
  audioUrl: string,
  annotations: any[],
  projectTitle: string
): Promise<void> {
  try {
    console.log('Starting WAV annotation embedding...');
    
    // Convert annotations to the expected format
    const formattedAnnotations: AudioAnnotation[] = annotations
      .filter(ann => !ann.parentId) // Only parent annotations
      .map(ann => ({
        id: ann.id,
        timestamp: ann.timestamp,
        text: ann.text,
        type: ann.annotationType,
        priority: ann.priority,
        user: ann.user?.username || 'Unknown'
      }));
    
    if (formattedAnnotations.length === 0) {
      throw new Error('No annotations to embed');
    }
    
    // Embed annotations into WAV file
    const embeddedWAV = await WAVMetadataEmbedder.embedAnnotationsInWAV(
      audioUrl,
      formattedAnnotations,
      projectTitle
    );
    
    // Download the file
    const sanitizedTitle = projectTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    const filename = `${sanitizedTitle} - With Annotations.wav`;
    
    WAVMetadataEmbedder.downloadEmbeddedWAV(embeddedWAV, filename);
    
    console.log(`Successfully embedded ${formattedAnnotations.length} annotations into WAV file`);
    
  } catch (error) {
    console.error('Failed to embed annotations in WAV:', error);
    throw error;
  }
}