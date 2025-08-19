#!/usr/bin/env python3
"""
Pro Tools .ptx file structure analyzer
"""
import struct
import os

def analyze_file_structure(file_path):
    """Analyze the binary structure of PTX file"""
    print(f"\n=== Analyzing structure of {file_path} ===")
    
    try:
        with open(file_path, 'rb') as f:
            data = f.read()
            
        print(f"File size: {len(data)} bytes")
        
        # Look for common patterns
        print("\n--- File Header Analysis ---")
        header = data[:100]
        print(f"First 100 bytes (hex): {header.hex()}")
        print(f"First 100 bytes (ascii, errors ignored): {repr(header.decode('ascii', errors='ignore'))}")
        
        # Look for repeated patterns that might indicate structure
        print("\n--- Looking for structural patterns ---")
        
        # Search for potential string tables or marker sections
        # Look for null-terminated strings
        strings = []
        current_string = b""
        for i, byte in enumerate(data):
            if byte == 0:  # null terminator
                if len(current_string) > 2:  # ignore very short strings
                    try:
                        decoded = current_string.decode('utf-8')
                        if len(decoded) > 2 and all(ord(c) < 128 for c in decoded):  # ASCII-like
                            strings.append((i - len(current_string), decoded))
                    except:
                        pass
                current_string = b""
            elif 32 <= byte <= 126:  # printable ASCII
                current_string += bytes([byte])
            else:
                if len(current_string) > 2:
                    try:
                        decoded = current_string.decode('utf-8')
                        if len(decoded) > 2 and all(ord(c) < 128 for c in decoded):
                            strings.append((i - len(current_string), decoded))
                    except:
                        pass
                current_string = b""
        
        print(f"Found {len(strings)} potential strings:")
        for pos, string in strings[:20]:  # Show first 20
            print(f"  {pos:6d}: {repr(string)}")
        
        if len(strings) > 20:
            print(f"  ... and {len(strings) - 20} more")
            
        # Look for 32-bit integers that might be timestamps or positions
        print("\n--- Looking for potential marker data ---")
        print("Searching for 4-byte integer patterns...")
        
        # Check for values that might be sample positions (assuming 44.1kHz)
        # If markers are at 30s, 60s, 90s, 120s, we'd expect:
        # 30s = 1,323,000 samples, 60s = 2,646,000 samples, etc.
        potential_markers = []
        for i in range(0, len(data) - 4, 4):
            try:
                # Try both little and big endian
                value_le = struct.unpack('<I', data[i:i+4])[0]
                value_be = struct.unpack('>I', data[i:i+4])[0]
                
                # Check if values could be sample positions for reasonable song positions
                for value in [value_le, value_be]:
                    if 0 < value < 10000000:  # 0 to ~227 seconds at 44.1kHz
                        seconds = value / 44100
                        if 10 < seconds < 300:  # Between 10 seconds and 5 minutes
                            potential_markers.append((i, value, seconds))
            except:
                continue
                
        if potential_markers:
            print(f"Found {len(potential_markers)} potential sample positions:")
            for pos, value, seconds in potential_markers[:10]:
                print(f"  Position {pos:6d}: {value:10d} samples = {seconds:6.1f} seconds")
        
    except Exception as e:
        print(f"Error analyzing file: {e}")

def compare_files(file1, file2):
    """Compare two PTX files to find differences"""
    print(f"\n=== Comparing {file1} and {file2} ===")
    
    try:
        with open(file1, 'rb') as f1, open(file2, 'rb') as f2:
            data1 = f1.read()
            data2 = f2.read()
            
        print(f"File 1 size: {len(data1)} bytes")
        print(f"File 2 size: {len(data2)} bytes")
        print(f"Size difference: {len(data2) - len(data1)} bytes")
        
        # Find first difference
        min_len = min(len(data1), len(data2))
        for i in range(min_len):
            if data1[i] != data2[i]:
                print(f"First difference at byte {i}")
                start = max(0, i - 20)
                end = min(min_len, i + 20)
                print(f"File 1 context: {data1[start:end].hex()}")
                print(f"File 2 context: {data2[start:end].hex()}")
                break
                
        # Look for sections that exist only in the larger file
        if len(data2) > len(data1):
            extra_data = data2[len(data1):]
            print(f"\nExtra data in file 2 ({len(extra_data)} bytes):")
            print(f"Hex: {extra_data[:50].hex()}...")
            try:
                print(f"ASCII: {repr(extra_data.decode('ascii', errors='ignore')[:50])}")
            except:
                pass
                
    except Exception as e:
        print(f"Error comparing files: {e}")

if __name__ == "__main__":
    # Analyze individual files
    analyze_file_structure(r"C:\ProToolsTests\empty_test\empty_test\empty_test.ptx")
    analyze_file_structure(r"C:\ProToolsTests\test_with_markers\test_with_markers.ptx")
    
    # Compare empty vs markers to see what's added
    compare_files(
        r"C:\ProToolsTests\empty_test\empty_test\empty_test.ptx",
        r"C:\ProToolsTests\test_with_markers\test_with_markers.ptx"
    )