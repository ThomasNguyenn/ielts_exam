import os

def check_files(path):
    bad_encoding = []
    # Common mojibake for Vietnamese characters
    mojibake = ['Ã', 'Ä', 'áº', 'á»', '']
    found_mojibake = []
    
    for root, dirs, files in os.walk(path):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '.next' in dirs: dirs.remove('.next')
        if 'dist' in dirs: dirs.remove('dist')
        if '.git' in dirs: dirs.remove('.git')
            
        for name in files:
            if not (name.endswith('.js') or name.endswith('.jsx')):
                continue
            filePath = os.path.join(root, name)
            try:
                with open(filePath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if any(m in content for m in mojibake):
                        found_mojibake.append(filePath)
            except UnicodeDecodeError:
                bad_encoding.append(filePath)
                
    with open('utf_issues.txt', 'w', encoding='utf-8') as f:
        f.write('Bad Encoding:\n')
        f.write('\n'.join(bad_encoding) + '\n\n')
        f.write('Mojibake:\n')
        f.write('\n'.join(found_mojibake) + '\n')
    print(f'Done. Found {len(bad_encoding)} bad encodings and {len(found_mojibake)} mojibake files.')

check_files(r'c:\Users\Guest User\Desktop\IeltsExam\frontend')
