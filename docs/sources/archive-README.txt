# Gift to the BF Community: Asset Backups

With the Global version of the game being shut down in April 2022, I wanted to contribute to the archival effort by providing one more fresh copy of (most?) assets used by the Global version of the game as of April 3, 2022 (+ some extra stuff I happened to save over the years).

Hopefully this won't be the last we'll see of Brave Frontier. Best of luck on your future endeavors fellow Summoners. May the information in this archive help keep the franchise alive in some way (or at least serve as a reminder of the memories we've had with the games).

Special thanks to...

* Gumi/Alim for providing Brave Frontier
* Deathmax for the original datamine info
* Hamza for his original work on the spark simulator
* The members of my guild BEZNexus for putting up with me as a Guild Master
* The BF Wiki team for anything we worked together on
* Aikenfell for help with gathering some of the assets

- BluuArc, Guild Master of BEZNexus, developer of the BFFrameAnimator, Project Sparkle, and the (unofficial) Brave Frontier Multi Tool (BF-MT)

## What's in here?

(Small aside: This file is written in a Markdown format. You may have an easier time reading this if you're text editor supports rendering Markdown.)

* 2022APR03-FULL-GL.txt - List of URLs used to download assets to the client as of April 3, 2022
	* Note that while this covers the majority of the assets, it actually does not contain everything due to certain things only being downloaded on demand and older files not being available
* assets.zip - Asset files (sprite sheets, images, cutscene text, sound effects, music, etc.) downloaded by the Windows version of the game client + some extra stuff I happened to save over the years + some manual scraping for GIF generation and resources for cutscenes
* assets-structure.txt - More detailed description of my understanding of the contents of each folder
* mst-decoded.zip - MST files partially decoded in JSON form
* gifs.zip - Generated GIF files of most non-SAM-based sprites in the game in three formats: transparent, black background, and white background
* old-mst.zip - older copies of the MST files from previous versions of the game
* account-archive-or-showcase - folder containing a recording of my BF account as of April 24, 2022; works to both keep a memory of what is in my account before the game closes and to have a recorded version of some common menus and game modes for future reference
* bfjp-exclusive-assets.zip - Select asset files exclusive to the Japan version of Brave Frontier (JPBF)
* bfjp-exclusive-assets.zip - Select asset files exclusive to the Japan version of Brave Frontier (JPBF)
* bfjp-exclusive-gifs.zip - GIFs generated from bfjp-exclusive-assets.zip
* bf2-assets.zip - CPK files for BF2
* bf2-assets-unpacked.zip - Unpacked CPK files for BF2
* bf2-gifs.zip - Generated GIF files for non-SAM-based sprites from BF2 in three formats: transparent, black background, and white background
* README.txt - This file you're reading explaining what's in this archive :)

## Some Q&A

### Why provide the decoded MSTs?

Short answer: Why not? It takes some work to decode the files. Maybe providing decoded versions will help in future fan projects to revive BF from the original files.

Long Answer:

If you're lost as to what MSTs are, there's a description under the mst folder section in the "asset-structure.txt" file which should be in the same folder as this readme file.

Every time the client logs in to the server, it checks if there are new MST files and downloads them to your device. The format they come in is some encoded format. A few steps were needed to get to this decoded state

1. Get the MST files. This is folder "1-mst" in the ZIP file.
2. Decrypt the files into a JSON format. This is folder "2-mst-decoded" in the ZIP file. While this works, all the keys for the data are not really human readable.
3. Try to swap the original keys for more human readable ones. This is "3-mst-translated" in the ZIP file. This takes something like "utP1c0CD" and swaps it to "unitName". Note that the not all keys are understood and subsequently may retain a portion of their original encoded name, like how "pA9ZoWa2" becomes "UNIT_pA9ZoWa2" in the F_UNIT_MST JSON files.

The next step afterwards is to generate datamine JSON files, like what's on https://github.com/cheahjs/bravefrontier_data and https://github.com/BluuArc/bfmt-data, or to use the data in some other way.

It took a lot of work to get into the current translated state, but even then not everything is fully understood. My hopes with providing these decoded MST files is that at most they may help with recreating parts of the game in some future fan project and at least they can help validate existing data on the wiki.

### Can we back up our account data?

Unfortunately I haven't found a way to access that with my current methods.

### How about assets for other Brave Frontier games?

Sorry, but if they aren't in this archive I don't have those assets. There are other community members who are helping to back up those games too.
