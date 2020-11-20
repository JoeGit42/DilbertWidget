// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: cyan; icon-glyph: user-tie;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: image;

// Platform: iOS 14
// Application: Scriptable app

//////////////////////////////////////////////////////////////////////////////////////////////
// Description of this widget
// ⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺
// Script shows german daily dilbert. Pics from www.ingenieur.de are used.
// To display a full comic strip, only one single pic is shown per widget.
// You have to add multiple widget in one stack. So you can scroll through the comic
// Widget parameter has to be set to select cover (0) or one iof the three pics (1, 2 or 3)
//
// Installation
// ⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺
// • install scriptable
// • add this script as a new script
// • create 4 scriptable widgets
// • select this script for all 4 widgets
// * each widget should get a number
//   - 1st widget: 0 (to show the cover, default)
//   - 2nd widget: 1 (to show the 1st pic of the comic)
//   - 3rd widget: 2 (to show the 2nd pic of the comic)
//   - 4th widget: 3 (to show the last pic of the comic)
// • if everything works fine, you can now scroll through the daily widget
//
// some tech details
// ⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺
//  • Images are only loaded once, to reduce traffic
//  • Some images are preloaded for the next days to have them in case of offline mode
//  • old images are deleted to reduce used space (a few hundred kBytes per image)
//  • cover is downloaded from a deeplink on iTunes (not sure, if this works for a long time)
//  • In widget environment Image handling is limited to resolution of 500x500px. This makes images blurry.
//    To avoid this limitation, images are handled as raw data
// 
// ToDo / Ideas
//⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺⎺
// (2) Support of english Dilbert
// (3) Support of other comic strips (should have squared single pics)
// (4) support of other formats (e.g. 4x2 in addition to 3x1) - can be assumed due to image ratio
// (5) other host for images
//
//////////////////////////////////////////////////////////////////////////////////////////////


// ## Debug Support
let DEBUG = false

// ## Configuration 
let forceDownload = false
let showInstructions = false

// ## Globals
let wParameter = []
let picNum = 0
let widget
const coverFileName = "dilbert_cover.raw"
const coverURL = "http://is3.mzstatic.com/image/thumb/Music/v4/c3/43/ba/c343ba75-b088-2d79-2ead-187d9fd864e9/source/600x600sr.jpg"
const dilbertFileNamePrefix = "dilbert_daily_"
const dilbertFileNameSuffix = ".raw"
const preLoadDays = 5
var fm = FileManager.local() // getFilemanager()
//let fmConfigDirectory = fm.joinPath(fm.documentsDirectory(), '/dilbertWidget')


// Basic widget creation
//
function createWidget() {
    widget = new ListWidget();
    return widget;
}


// Load Dilbert-Image from german website
// then update widget
//
async function loadPhotoDilbert(widget) {
    let widgetURL = ""
    let day = new Date()
    let today = new Date()
    let numTries = 0
    let gotStrip = false
    let gotCover = false
    let DilbertStrip
    let DilbertCover


    // only support for comic strips with 3 pics in 1 row
    const numRows = 1
    const numCols = 3

    // read given widget-parameters given by user configuration
    let parCount = parseInput(args.widgetParameter)

    if (showInstructions) {
      showInstallInstructions()
      return
    }

    // Check, if a comic can be found. Check 5 previous days, if necessary.
    do {
        numTries += 1
        day = addDay(today, (-1) * (numTries - 1))
        widgetURL = getDailyDilbertURL(day)
        await debug_print_async(widgetURL);

        try {
            DilbertStrip = await fetchDaily(day);
            if (typeof DilbertStrip === 'object') {
                gotStrip = true
            }
        } catch (err) {

        }
    }
    while (numTries < 5 && gotStrip == false)

    // load Dilberts for the next two days, to be prepared for offline mode
    await preloadDilbertComic(preLoadDays);
    
    // special handling for the cover image
    if (picNum == 0) {
        try {
            DilbertCover = await fetchCover();
            if (typeof DilbertCover === 'object') {
                gotCover = true
            }
        } catch (err) {
            widget.addText("no Dilbert cover found :-(")
        }
        if (gotCover) {
            widget.backgroundImage = DilbertCover
        }
        widget.url = "https://www.ingenieur.de/unterhaltung/dilbert/"
        printCoverDate(day)
    } else { // picNum != 0
        // handling of the comic
        if (gotStrip) {
            picNum = minmax(picNum, 1, numRows * numCols)

            let col = (picNum % numRows)
            if (col == 0) {
                col = picNum / numRows
            }
            let row = Math.floor((picNum - 1) / numCols) + 1
            // to avoid misscalculations
            col = minmax(col, 1, numCols)
            row = minmax(row, 1, numRows)

            let singlePic = getSingleComicPicture(DilbertStrip, numRows, numCols, row, col)
            if (typeof singlePic === 'object') {
                widget.backgroundImage = singlePic
            }
            widget.url = widgetURL;

        } else {
            widget.addText("no daily Dilbert found :-(")
        }
    }
    // clear local directory
    await clearLocalDir();
}


function checkImageExists(localPath) {
    //let fm = FileManager.local()
    let dir = fm.documentsDirectory()
    let path = fm.joinPath(dir, localPath)
    debug_print("" /*+ localPath*/ + "(" + fm.fileSize(path) + " kB)");
    return fm.fileExists(path)
}

// fetches the image once, after that the local copy is used
async function fetchImage(localPath, remoteURL) {
    //let fm = FileManager.local()
    let dir = fm.documentsDirectory()
    let path = fm.joinPath(dir, localPath)
    let file_exists = false
    let gotRemoteImage = false
    let cImage
    let rawData

    // check if file already exists
    try {
        if (fm.fileExists(path)) {
            rawData = await fm.read(path);
            await debug_print_async("" /*+ localPath*/ + "(" + fm.fileSize(path) + " kB)");
            cImage = Image.fromData(rawData)
            if (typeof cImage === 'object') {
                exists = true
            }
        }
    } catch (err) {
        file_exists = false
    }

    if (forceDownload) file_exists = false

    if (!file_exists) {
        try {
            rawData = await loadImage(remoteURL);
            if (typeof rawData === 'object') {
                gotRemoteImage = true
                cImage = Image.fromData(rawData)
                await fm.write(path, rawData);
                await debug_print_async("written " /*+ localPath*/ + "(" + fm.fileSize(path) + " kB)");
            }
        } catch (err) {
            gotRemoteImage = false
        }
    }

    return cImage
}


// fetches the cover once, after that the local copy is used
async function fetchCover() {
    return await fetchImage(coverFileName, coverURL);
}

// fetches the daily once, after that the local copy is used
async function fetchDaily(day) {
    return await fetchImage(getDailyDilbertLocalFileName(day), getDailyDilbertURL(day));
}

// print date on cover
function printCoverDate(date) {
    let dfDate = dfCreateAndInit("yyyy-MM-dd")
    let fontSize = 24 // large size widget
    let spacerHeight = 45 // large size widget

    if (config.runsInWidget) {
        fontSize = (config.widgetFamily.indexOf("small") >= 0) ? 12 : 24
        spacerHeight = (config.widgetFamily.indexOf("small") >= 0) ? 12 : 45
    }
    widget.addSpacer(spacerHeight)
    let stack = widget.addStack()
    let dateLine = stack.addText(dfDate.string(date))
    dateLine.font = Font.thinMonospacedSystemFont(fontSize)
    dateLine.textColor = Color.white()
    widget.addSpacer()
}

// print date on cover
function showInstallInstructions() {
    let fontSize = 16 // large size widget or app

    if (config.runsInWidget) {
        fontSize = (config.widgetFamily.indexOf("small") >= 0) ? 8 : fontSize
    }
    
    widget.addSpacer()
    let instructionStack = widget.addStack()    
    instructionStr = "🛠 INSTALLATION\n"
    instructionStr += "• create 4 scriptable widgets\n"
    instructionStr += "• select this script for all 4\n"
    instructionStr += "• each widget gets a number\n"
    instructionStr += "    as parameter\n"
    instructionStr += "    - 1st widget: 0 (cover)\n"
    instructionStr += "    - 2nd widget: 1 (1st pic)\n"
    instructionStr += "    - 3rd widget: 2 (2nd pic)\n"
    instructionStr += "    - 4th widget: 3 (last pic)\n"
    instructionStr += "• combine widgets in 1 stack"

    let textLine =  instructionStack.addText(instructionStr)      
    textLine.font = Font.mediumSystemFont(fontSize)
    widget.addSpacer()
}

// Loads images for the next 3 days into local directory
async function preloadDilbertComic(days) {
    let day = new Date()
    let localFileName = ""

    for (i = 1; i <= days; i++) {
        localFileName = getDailyDilbertLocalFileName(addDay(day, i))
        if (!checkImageExists(localFileName)) {
            await fetchImage(localFileName, getDailyDilbertURL(addDay(day, i)));
        }
    }
}

// crop image used for comic strips.
// comic strip with spaces between pics are supported
// offsets at the borders is not yet supported
function getSingleComicPicture(img, rows, columns, selectedRow, selectedColumn) {
    let draw = new DrawContext()
    let spacerFactor = 22.0 / 313.0 // spacer to the next pic (values are taken from a real pic)
    let blackBorderFactor = 4.0 / 313.0

    //draw.respectScreenScale = true // ### should delete blur effect in widget, but doesn't work for any reason

    // calculate net size of one pic (inkl. black border)
    let singlePicWidth = img.size.width / (columns + ((columns - 1) * spacerFactor))
    let singlePicHeight = img.size.height / (rows + ((rows - 1) * spacerFactor))

    // calculate pos of selected pic
    let ulPoint = new Point(0, 0)
    ulPoint.x = singlePicWidth * (1 + spacerFactor) * (selectedColumn - 1)
    ulPoint.y = singlePicHeight * (1 + spacerFactor) * (selectedRow - 1)

    // delete black border of 5px (1,76% of pic-width)
    ulPoint.x += singlePicWidth * blackBorderFactor
    ulPoint.y += singlePicHeight * blackBorderFactor
    singlePicWidth *= (1 - (2 * blackBorderFactor))
    singlePicHeight *= (1 - (2 * blackBorderFactor))

    //draw.size = new Size(singlePicWidth, singlePicHeight)
    draw.size = new Size(singlePicWidth, singlePicHeight)
    ulPoint.x *= (-1)
    ulPoint.y *= (-1)
    draw.drawImageAtPoint(img, ulPoint)

    return draw.getImage()
}

function getDailyDilbertURL(date) {
    // e.g. 2020-11-14 results in this URL: https://www.machinebuilding.net/uploads/mbuild/dilbert/dt201114.gif
    let imgURL = "https://www.ingenieur.de/wp-content/uploads/#yyyy#/#MM#/#dd##MM#.jpg"

    // do not build an URL for sundays - have to know the mechanism first
    let dfReplaceYear = dfCreateAndInit("yyyy")
    let dfReplaceMonth = dfCreateAndInit("MM")
    let dfReplaceDay = dfCreateAndInit("dd")
    imgURL = imgURL.replace(/#yyyy#/g, dfReplaceYear.string(date))
    imgURL = imgURL.replace(/#MM#/g, dfReplaceMonth.string(date))
    imgURL = imgURL.replace(/#dd#/g, dfReplaceDay.string(date))

    return imgURL
}

function getDailyDilbertLocalFileName(date) {
    let dfDate = dfCreateAndInit("yyyy-MM-dd")
    let local = dilbertFileNamePrefix + dfDate.string(date) + dilbertFileNameSuffix
    return local
}

// creates and inits a DateFormatter
function dfCreateAndInit(format) {
    const df = new DateFormatter()
    df.dateFormat = format
    return df
}


// create widget, load image and push widget
widget = createWidget();
await loadPhotoDilbert(widget);

// check environment to just display widget content
// when running from Scriptable app
if (config.runsInWidget) {
    Script.setWidget(widget);
} else {
    widget.presentLarge();
}


// parses the widget parameters
function parseInput(input) {
    if (input != null && input.length > 0) {
        wParameter = input.split(",")

        let parCount = wParameter.length

        // take over the given parameters to global variables
        if (parCount > 0) {
            picNum = parseInt(wParameter[0])
        }
        if (parCount > 1) {
            DEBUG = (wParameter[1].indexOf("debug") >= 0)
        }
        if (parCount > 2) {
            forceDownload = (wParameter[2] == "force")
        }

        return wParameter.length
    } else {
        // settings for usage in app or non configured widget 
        //DEBUG = true
        //picNum = 2
        showInstructions = true
    }
    return 0
}

async function clearLocalDir() {
    //let fm = FileManager.local()
    let dir = fm.documentsDirectory()
    let path
    let today = new Date()
    var doNotDelete = [coverFileName]
    let deleteFile = false

    // prepare string-array with filenames, which should not be deleted (previous 2 and a configurable number of next days)
    for (i = -2; i <= preLoadDays; i++) {
        doNotDelete.push(getDailyDilbertLocalFileName(addDay(today, i)))
    }

    // get directory content
    let dirContent = fm.listContents(dir)
    for (i = 0; i < dirContent.length; i++) {
        if (fm.fileName(dirContent[i]).indexOf(dilbertFileNamePrefix) >= 0 || fm.fileName(dirContent[i], true).indexOf(coverFileName) >= 0) {
            // check if candidate to delete is part of list to not delete
            deleteFile = true
            for (u = 0; u < doNotDelete.length; u++) {
                if (fm.fileName(dirContent[i], true).indexOf(doNotDelete[u]) >= 0) {
                    deleteFile = false
                }
            }
            if (deleteFile || forceDownload) {
                path = fm.joinPath(dir, dirContent[i])
                try {
                    await fm.remove(path);
                } catch (err) {
                    debug_print("fail rm " + fm.fileName(dirContent[i], true))
                }
            }
        }
    }
}

/* //- ised to delete dilbert jpg-files. (stored as .raw files now)
async function hardCleanLocalDir () {
  let fm = FileManager.local()
  let dir = fm.documentsDirectory()
  let path

  // get directory content
  let dirContent = fm.listContents(dir)
  await debug_print_async("dir: " + dirContent.length);
  for (i=0; i<dirContent.length; i++) {
    if ( fm.fileName(dirContent[i]).indexOf("dilbert_") >= 0 && fm.fileName(dirContent[i], true).indexOf(".jpg") >= 0  ) {
      path = fm.joinPath(dir, dirContent[i])
      try {
        await fm.remove(path);
        await debug_print_async("rm " + fm.fileName(dirContent[i], true));
      } catch (err) {
        await debug_print_async("fail rm " + fm.fileName(dirContent[i], true));
      }
    }
  }
}
*/

async function loadImage(imgUrl) {
    const req = new Request(imgUrl)
    return await req.load(); // returns RAW data
}

function minmax(num, min, max) {
    return Math.min(Math.max(num, min), max)
}

// days will be added (can be negative)
function addDay(d, diff) {
    d2 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
    //d.setTime( d2.getTime() )
    return d2
}

function getFilemanager() {
    try {
        fm = FileManager.iCloud()
    } catch (err) {
        fm = FileManager.local()
    }

    try {
        fm.documentsDirectory()
    } catch (err) {
        fm = FileManager.local()
    }
    return fm
}

function debug_print(text) {
    if (!DEBUG) {
        return
    }

    let debugRow = widget.addStack()
    let debugText = debugRow.addText(text)
    debugText.font = Font.mediumSystemFont(8)
    debugText.textColor = Color.blue()
}

async function debug_print_async(text) {
    if (!DEBUG) {
        return
    }

    let debugRow = widget.addStack()
    let debugText = debugRow.addText(text)
    debugText.font = Font.mediumSystemFont(8)
    debugText.textColor = Color.blue()
}

// We must notify caller that script ended
Script.complete();
