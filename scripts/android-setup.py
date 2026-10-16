"""Customises the Android project that `npx cap add android` generates: signing, version, icons, splash, sign-in link."""
import glob, os, pathlib, re, shutil

app = pathlib.Path('android/app')
code = os.environ.get('VERSION_CODE', '1')

# 1. version + release signing
gradle = (app / 'build.gradle').read_text()
gradle = re.sub(r'versionCode \d+', f'versionCode {code}', gradle, count=1)
signing = """
    signingConfigs {
        release {
            storeFile file(System.getenv('KS_FILE'))
            storePassword System.getenv('KS_PASS')
            keyAlias 'edgeblast'
            keyPassword System.getenv('KS_PASS')
        }
    }
"""
assert '        release {\n' in gradle, 'release build type not found'
gradle = gradle.replace('        release {\n', '        release {\n            signingConfig signingConfigs.release\n', 1)
assert '\nandroid {\n' in gradle, 'android block not found'
gradle = gradle.replace('\nandroid {\n', '\nandroid {\n' + signing, 1)
(app / 'build.gradle').write_text(gradle)

# 2. sign-in link (app.edgeblast.app://auth) + notification permission
manifest_path = app / 'src/main/AndroidManifest.xml'
manifest = manifest_path.read_text()
link = """            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="app.edgeblast.app" android:host="auth" />
            </intent-filter>
"""
assert '</activity>' in manifest, 'activity not found'
manifest = manifest.replace('</activity>', link + '        </activity>', 1)
if 'POST_NOTIFICATIONS' not in manifest:
    manifest = manifest.replace('</manifest>', '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n</manifest>')
manifest_path.write_text(manifest)

# 3. icons, dark splash
res = app / 'src/main/res'
for old in glob.glob(str(res / '**/splash.png'), recursive=True):
    os.remove(old)
for src in pathlib.Path('native-res').rglob('*'):
    if src.is_file():
        dst = res / src.relative_to('native-res')
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, dst)
print('android project customised')
