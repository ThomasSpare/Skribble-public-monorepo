#!/usr/bin/env python3
"""
Pro Tools .ptx file analyzer
"""

def find_marker_strings(file_path, search_terms):
    """Search for specific strings in binary file"""
    try:
        with open(file_path, 'rb') as f:
            data = f.read()
            
        results = []
        for term in search_terms:
            # Search for both regular and UTF-16 encodings
            term_bytes = term.encode('utf-8')
            term_utf16 = term.encode('utf-16le')
            
            # Find UTF-8 occurrences
            offset = 0
            while True:
                pos = data.find(term_bytes, offset)
                if pos == -1:
                    break
                # Get context around the match
                start = max(0, pos - 50)
                end = min(len(data), pos + len(term_bytes) + 50)
                context = data[start:end]
                results.append({
                    'term': term,
                    'encoding': 'UTF-8',
                    'position': pos,
                    'context': context
                })
                offset = pos + 1
                
            # Find UTF-16 occurrences
            offset = 0
            while True:
                pos = data.find(term_utf16, offset)
                if pos == -1:
                    break
                start = max(0, pos - 50)
                end = min(len(data), pos + len(term_utf16) + 50)
                context = data[start:end]
                results.append({
                    'term': term,
                    'encoding': 'UTF-16LE',
                    'position': pos,
                    'context': context
                })
                offset = pos + 1
                
        return results
        
    except Exception as e:
        print(f"Error reading file: {e}")
        return []

def analyze_ptx_file(file_path):
    """Analyze PTX file structure"""
    print(f"\n=== Analyzing {file_path} ===")
    
    # Search for marker names
    marker_terms = ['Intro', 'Verse 1', 'Chorus', 'Outro']
    results = find_marker_strings(file_path, marker_terms)
    
    if results:
        print(f"Found {len(results)} marker references:")
        for result in results:
            print(f"\nMarker: {result['term']} ({result['encoding']})")
            print(f"Position: {result['position']}")
            print(f"Context (hex): {result['context'].hex()}")
            # Try to show readable context
            try:
                readable = result['context'].decode('utf-8', errors='ignore')
                print(f"Context (text): {repr(readable)}")
            except:
                print("Context not readable as UTF-8")
    else:
        print("No marker names found")
        
    # Get file size
    try:
        import os
        size = os.path.getsize(file_path)
        print(f"File size: {size} bytes")
    except:
        pass

if __name__ == "__main__":
    # Analyze the markers file
    analyze_ptx_file(r"C:\ProToolsTests\test_with_markers\test_with_markers.ptx")
    
    # Also check the empty file for comparison
    analyze_ptx_file(r"C:\ProToolsTests\empty_test\empty_test\empty_test.ptx")