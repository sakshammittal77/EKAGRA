# EKAGRA browser tests

Start the app first (`start-local.bat` in the project folder), then:

```
cd qa
npm install
mkdir shots
npm run all        # every page at 1356x570, 1440x900 and 375px: overlaps, clipping, sideways scroll
npm run voice      # Arya's natural voice + speed change, and narration inside the exported video
npm run narration  # plays a full reel: each narration clip keeps its pitch and is never cut off
npm run history    # mark learned -> cards move up, Undo, History page
npm run controls   # player buttons stay inside the player on all sizes
npm run login      # login card fits in all four languages
```

The tests use Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; change `executablePath` if yours is elsewhere. Screenshots go to `qa/shots/`.
