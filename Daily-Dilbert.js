// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: cyan; icon-glyph: user-tie;

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
//
//////////////////////////////////////////////////////////////////////////////////////////////


// ## Debug Support
let DEBUG = false
let iDEBUG = false // send debug to textfile on iCloud
const debugArgs = "2, dilbert"   // used in debug environment, to have widget configuration 
const appArgs = ""           // used in app environment, to have widget configuration 
const iDebugConsole = "DailyDilbertConsole.txt"


// ## Configuration 
let forceDownload = false
let showInstructions = false

// ## Globals
let wParameter = []
let picNum = 0
let widget
var fm = FileManager.local() // getFilemanager()
var ifm = FileManager.iCloud()
let singlePic

// ## Globals to adjust for different Comics (Dilbert, Peanuts)
// defaults are prepared for dilbert
// can be overwritten in function parseInput(), if widgetparameter is set to e.g. "peanuts"
let comic = "dilbert_de"
let coverFileName = "dilbert_cover.raw"
let coverURL = "http://is3.mzstatic.com/image/thumb/Music/v4/c3/43/ba/c343ba75-b088-2d79-2ead-187d9fd864e9/source/600x600sr.jpg"
let comicFileNamePrefix = "dilbert_daily_"
let comicFileNameSuffix = ".raw"
let comicCoverURL = "https://www.ingenieur.de/unterhaltung/dilbert/"  // only for cover. The pics get URL from complete comic image
let numRows = 1
let numCols = 3
let preLoadDays = 0  // does not really work, as URL-scheme is unpredictable and has to be catche from webpage each day
let spacerFactor = 22.0 / 313.0     // spacer to the next pic (values are taken from a real pic)
let blackBorderFactor = 4.0 / 313.0 // black Border shouldn't be shown in widget
let spacerHeight4CoverSmall = 12
let spacerHeight4CoverLarge = 45
let fontColor4Cover = Color.white()
let font4CoverSmall = Font.thinMonospacedSystemFont(12) 
let font4CoverLarge = Font.thinMonospacedSystemFont(24) 
let df4Cover = "yyyy-MM-dd"

const maxSize4DilbertDE = 800    

// Basic widget creation
//
function createWidget() {
    widget = new ListWidget();
    return widget;
}


// Load daily Dilbert (or other) Image from website
// then update widget
//
async function loadComic(widget) {
    let widgetURL = ""
    let day = new Date()
    let today = new Date()
    let numTries = 0
    let gotStrip = false
    let gotCover = false
    let comicStrip
    let comicCover
    
    // read given widget-parameters given by user configuration
    await debug_print_async("*******************************");
    await debug_print_async("widget parameter: " + args.widgetParameter);
    let parCount = parseInput(args.widgetParameter)

    if (showInstructions) {
      showInstallInstructions()
      widget.url = "https://github.com/JoeGit42/DilbertWidget"
      return
    }

    // Check, if a comic can be found. Check 5 previous days, if necessary.
    do {
        numTries += 1
        day = addDay(today, (-1) * (numTries - 1))
        widgetURL = comicCoverURL;

        await debug_print_async(widgetURL);

        try {
            comicStrip = await fetchDaily(day);
            if (typeof comicStrip === 'object') {
                // Check, if image has more or less the expected resolution. It should fit to the number of rows and columns.
                // Sometimes comic strip is completely different than expected. Ignore such images.
                if (comicStrip.size.width) {
                    const expectedRatio = (numCols + (numCols-1)*spacerFactor) / (numRows + (numRows-1)*spacerFactor)
                    const imageRatio = comicStrip.size.width / comicStrip.size.height
                    // difference in real and expcted ratio is less than 20%
                    if (Math.abs( (expectedRatio-imageRatio) / expectedRatio) < 0.2) {
                      gotStrip = true
                    }
                }                
            }
        } catch (err) {

        }
    }
    while (numTries < 5 && gotStrip == false)

    // load comics for the next n days, to be prepared for offline mode
    await preloadComic(preLoadDays);
    
    // special handling for the cover image
    if (picNum === 0) {
        try {
            comicCover = await fetchCover();
            if (typeof comicCover === 'object') {
                gotCover = true
            }
        } catch (err) {
            widget.addText("no cover found :-(")
        }
        if (gotCover) {
            widget.backgroundImage = comicCover
        }
        widget.url = comicCoverURL
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

            singlePic = await getSingleComicPicture(comicStrip, numRows, numCols, row, col);
            if (typeof singlePic === 'object') {
                widget.backgroundImage = singlePic
            }
            widget.url = widgetURL;

        } else {
            widget.addText("no daily picture found :-(")
        }
    }
    // clear local directory
    await clearLocalDir();
    //await hardCleanLocalDir();
    await debug_print_async("+++++++++++++++++++++++++++++++");

}


function checkImageExists(localPath) {
    //let fm = FileManager.local()
    let dir = fm.documentsDirectory()
    let path = fm.joinPath(dir, localPath)
    debug_print("check " + localPath + "(" + fm.fileSize(path) + " kB)");
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
            await debug_print_async("read " + localPath + "(" + fm.fileSize(path) + " kB)");
            cImage = Image.fromData(rawData)
            if (typeof cImage === 'object') {
                file_exists = true
            }
        }
    } catch (err) {
        file_exists = false
    }

    if (forceDownload) file_exists = false

    if (!file_exists && remoteURL) {
        if (remoteURL.length > 5) { // reasonable URL should have lots more than 5 characters
            try {
                rawData = await loadImage(remoteURL);
                if (typeof rawData === 'object') {
                    gotRemoteImage = true
                    cImage = Image.fromData(rawData)
                    await fm.write(path, rawData);
                    await debug_print_async("written " + localPath + "(" + fm.fileSize(path) + " kB)");
                }
            } catch (err) {
                gotRemoteImage = false
            }
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
    const localFileName = getDailyLocalFileName(day)
    let remoteURL = null
    
    // Only prepare the URL, if image does not exist in cache.
    // URL preparation in case of peanuts, needs loading of webpage to parse for image url
    // This avoid loading webpage in this case.
    if (!checkImageExists(localFileName) || forceDownload) {
      remoteURL = await getDailyComicURL(day);
    }
    
    return await fetchImage(getDailyLocalFileName(day), remoteURL);
}

// print date on cover
function printCoverDate(date) {
    let dfDate = dfCreateAndInit(df4Cover)
    let font4Cover = font4CoverLarge // large size widget
    let spacerHeight = spacerHeight4CoverLarge // large size widget

    if (config.runsInWidget) {
        font4Cover = (config.widgetFamily.indexOf("small") >= 0) ? font4CoverSmall : font4CoverLarge
        spacerHeight = (config.widgetFamily.indexOf("small") >= 0) ? spacerHeight4CoverSmall : spacerHeight4CoverLarge
    } 
    widget.addSpacer(spacerHeight)
    let stack = widget.addStack()
    let dateLine = stack.addText(dfDate.string(date))
    dateLine.font = font4Cover
    dateLine.textColor = fontColor4Cover
    widget.addSpacer()
}

// print date on cover
function showInstallInstructions() {
    let fontSize = 16 // large size widget or app

    if (config.runsInWidget) {
        fontSize = (config.widgetFamily.indexOf("small") >= 0) ? 7 : fontSize
    }
    
    widget.addSpacer(5)
    let instructionStack = widget.addStack()    
    instructionStr = "🛠 INSTALLATION\n"
    instructionStr += "• create x scriptable widgets\n"
    instructionStr += "• select this script for all\n"
    instructionStr += "• each widget gets a number\n"
    instructionStr += "   as parameter\n"
    instructionStr += "   - 1st widget: 0 (cover)\n"
    instructionStr += "   - 2nd widget: 1 (1st pic)\n"
    instructionStr += "   - 3rd widget: 2 (2nd pic) ...\n"
    instructionStr += "• as 2nd parameter select\n"
    instructionStr += "   comic (dilbert-en or peanuts)\n"
    instructionStr += "• e.g.:    2,dilbert\n"
    instructionStr += "• combine widgets in 1 stack"

    let textLine =  instructionStack.addText(instructionStr)      
    textLine.font = Font.mediumSystemFont(fontSize)
    widget.addSpacer()
}

// Loads images for the next 3 days into local directory
async function preloadComic(days) {
    let day = new Date()
    let localFileName = ""

    if (days <= 0) { return }
    
    for (i = 1; i <= days; i++) {
        localFileName = getDailyLocalFileName(addDay(day, i))
        if (!checkImageExists(localFileName) || forceDownload) {
            await fetchImage(localFileName, await getDailyComicURL(addDay(day, i)));
        }
    }
}

// crop image used for comic strips.
// comic strip with spaces between pics are supported
// offsets at the borders is not yet supported
async function getSingleComicPicture(img, rows, columns, selectedRow, selectedColumn) {
    let draw = new DrawContext()
    let diffWidth  = 0
    let diffHeight = 0

    draw.respectScreenScale = true 
    draw.opaque = false
    
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

    // special-handling for garfield pics, as they do not have equal size
    if (comic == "garfield" && rows == 1 && columns == 3) {
      switch ( selectedColumn ) {
        case 1:
          singlePicWidth = (292*img.size.width)/900
          singlePicHeight = (251*img.size.height)/258
          ulPoint.x = (4*img.size.width)/900
          ulPoint.y = (4*img.size.height)/258
          break;
        case 2:
          singlePicWidth = (270*img.size.width)/900
          singlePicHeight = (253*img.size.height)/258
          ulPoint.x = (315*img.size.width)/900
          ulPoint.y = (3*img.size.height)/258
          break;
        case 3:
          singlePicWidth = (292*img.size.width)/900
          singlePicHeight = (251*img.size.height)/258
          ulPoint.x = (603*img.size.width)/900
          ulPoint.y = (4*img.size.height)/258
          break;  
      } 
    }

    // Make it square and remember the diff
    // But only if there's a difference bigger than 5%. 
    // In all other cases, optimization can make it even worth.
    if ( (Math.abs(singlePicWidth - singlePicHeight) / singlePicWidth) >= 0.05 )
    {
      diffWidth  = Math.abs(singlePicWidth - Math.max(singlePicWidth, singlePicHeight))
      diffHeight = Math.abs(singlePicHeight - Math.max(singlePicWidth, singlePicHeight))
      singlePicWidth = Math.max(singlePicWidth, singlePicHeight)
      singlePicHeight = singlePicWidth
    }
    
    draw.size = new Size(singlePicWidth, singlePicHeight)

    // move img to the middle
    if ( diffWidth || diffHeight )
    {  
      ulPoint.x -= diffWidth/2
      ulPoint.y -= diffHeight/2
    }
    ulPoint.x *= (-1)
    ulPoint.y *= (-1)

    await debug_print_async ("call drawImageAtPoint()");
    try {
      draw.drawImageAtPoint(img, ulPoint)
    } catch (e) {
      await debug_print_async ("fail drawImageAtPoint(); size: " + singlePicWidth + "x" + singlePicHeight );
    }
    await debug_print_async ("back from drawImageAtPoint()");

    // Sometimes the border are not accurate.
    // so daw rectangles on top/bottom or left/right with a small overlap
    if ( diffHeight > 4 ) // top and bottom
    {  
      const borderThickness = (diffHeight/2) + (singlePicHeight*blackBorderFactor)
      draw.fill(new Rect(0, 0, singlePicWidth, borderThickness))
      draw.fill(new Rect(0, singlePicHeight - borderThickness, singlePicWidth, borderThickness))
    }
    if ( diffWidth > 4 ) // left and right 
    {  
      const borderThickness = (diffWidth/2) + (singlePicWidth*blackBorderFactor)
      draw.fill(new Rect(0, 0, borderThickness, singlePicHeight))
      draw.fill(new Rect(singlePicWidth - borderThickness, 0, borderThickness, singlePicHeight))
    }

    return draw.getImage()
}

async function getDailyDilbertENURL(date) {
  const webpage2parse = "https://dilbert.com"
  const req = new Request(webpage2parse)
  let html = await req.loadString();
  let df = dfCreateAndInit("yyyy-MM-dd")
  let start
  let end
  let imgURL = ""
    
  start = html.toLowerCase().indexOf("data-id=\"" + df.string(date) + "\"")
  if ( start >=0 ) {
    // found block for this day
    html = html.substring(start)
    start = html.toLowerCase().indexOf("data-image=")
    if ( start >=0 ) {
      // found data-image line, which includes url
      html = html.substring(start+12)
      end = html.indexOf("\"")
      if ( end > 5 ) {
        // found end of srcset
        html = html.substring(0,end)
        html = html.trim()
        imgURL = html
      }
    }
  }
  return imgURL
}

async function getDailyDilbertDEURL(date) {
  const webpage2parse = "https://www.ingenieur.de/unterhaltung/dilbert/"
  const req = new Request(webpage2parse)
  let html = await req.loadString();
  let df = dfCreateAndInit("dd.MM.yyyy")
  let start
  let end
  let imageStrings = []
  let imgURL = ""
    
  start = html.toLowerCase().indexOf("vom " + df.string(date))
  if ( start >=0 ) {
    // found block for this day
    html = html.substring(start)
    start = html.toLowerCase().indexOf("srcset=")
    if ( start >=0 ) {
      // found srcset
      html = html.substring(start+8)
      end = html.indexOf("\"")
      if ( end > 5 ) {
        // found end of srcset
        html = html.substring(0,end-1)
        imageStrings = html.split(",")
        let imageStringsCount = imageStrings.length
        let iBiggest = 0
        let iBiggestResolution = 0
        let urlStr = ""
        let resolutionStr = ""
        for (i=0; i<imageStringsCount; i++){
          // try to find the picuture with the biggest resolution (but not bigger than maxSize4DilbertDE)
          imageStrings[i] = imageStrings[i].trim()
          start = imageStrings[i].indexOf(" ")
          if (start > 5) {
            // string has 2 parts (1st part is the URL 2nd part is the resolution
            urlStr = imageStrings[i].substring(0, start)
            resolutionStr = imageStrings[i].substring(start)
            urlStr = urlStr.trim()
            resolutionStr = resolutionStr.trim()
            end = resolutionStr.toLowerCase().indexOf("w")
            if ( end > 0 ){
              resolutionStr = resolutionStr.substring(0, end)
            }
            imageResolution = parseInt(resolutionStr)
            await debug_print_async("found pic with " + imageResolution + "px");
            if (imageResolution <= maxSize4DilbertDE && imageResolution > iBiggestResolution) {
               imgURL = urlStr 
               iBiggestResolution = imageResolution
               await debug_print_async("choosen " + imageResolution);
            }
          }
        }
      }
    }
  }
  return imgURL
}

async function getDailyComicURL(date) {
  let imgURL = ""
  let req
  let html
  let match
  
  // build basic URL
  switch (comic) {
    case "peanuts":
      imgURL = "https://www.gocomics.com/peanuts/#yyyy#/#MM#/#dd#"
      break;
    case "garfield":
      imgURL = "https://www.gocomics.com/garfield/#yyyy#/#MM#/#dd#"
      break;
      case "dilbert_de":
      case "dilbert_en":
      default:
        // no preparation of URL
  }

  let dfReplaceYear = dfCreateAndInit("yyyy")
  let dfReplaceMonth = dfCreateAndInit("MM")
  let dfReplaceDay = dfCreateAndInit("dd")
  imgURL = imgURL.replace(/#yyyy#/g, dfReplaceYear.string(date))
  imgURL = imgURL.replace(/#MM#/g, dfReplaceMonth.string(date))
  imgURL = imgURL.replace(/#dd#/g, dfReplaceDay.string(date))
      
  switch (comic) {
    case "peanuts":
    case "garfield":
      // get image URL from website
      req = new Request(imgURL)
      try {
        html = await req.loadString();
        match = html.match(/og:image"\scontent="([^"]+)/)
        imgURL = match[1] 
      } catch (e) {
        imgURL = ""
      }
      await debug_print_async ("peanuts/garfield url: " + imgURL);   
      break;
      
    case "dilbert_en":
      imgURL = await getDailyDilbertENURL(date);
      await debug_print_async ("dilbert_en url: " + imgURL); 
      break;
      
    case "dilbert_de":
    default:
      imgURL = await getDailyDilbertDEURL(date);
      await debug_print_async ("dilbert_de url: " + imgURL); 
  }

  return imgURL
}

function getDailyLocalFileName(date) {
    let dfDate = dfCreateAndInit("yyyy-MM-dd")
    let local = comicFileNamePrefix + dfDate.string(date) + comicFileNameSuffix
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
await loadComic(widget);

// check environment to just display widget content
// when running from Scriptable app
if (config.runsInWidget) {
    Script.setWidget(widget);
} else {
    widget.presentLarge();
}


// parses the widget parameters
function parseInput(input) {
    if (DEBUG){
      input = debugArgs
    } else if (!config.runsInWidget) {
      input = appArgs
    }
    if (input != null && input.length > 0) {
        wParameter = input.split(",")

        let parCount = wParameter.length

        // take over the given parameters to global variables
        if (parCount > 0) {
            picNum = parseInt(wParameter[0])
        }
        if (parCount > 1) {
            switch (wParameter[1].toLowerCase().trim()) {
              case "peanuts":
              case "peanuts_en":
              case "peanuts-en":
              case "peanutsen":
                comic = "peanuts"
                coverFileName = comic + "_cover.raw"
                coverURL = "https://www.peanuts.com/sites/default/files/cb-color.jpg"
                comicFileNamePrefix = comic + "_daily_"
                comicFileNameSuffix = ".raw"
                comicCoverURL = "https://www.gocomics.com/peanuts/"  // only for cover. The pics get URL from complete comic image
                numRows = 1
                numCols = 4
                preLoadDays = 0  // no upcoming comics available 
                spacerFactor = 11.0 / 211.0 // spacer to the next pic (values are taken from a real pic)
                blackBorderFactor = 2.0 / 211.0
                spacerHeight4CoverSmall = 69
                spacerHeight4CoverLarge = 170
                font4CoverSmall = Font.semiboldSystemFont(10) 
                font4CoverLarge = Font.semiboldSystemFont(20) 
                fontColor4Cover = Color.black()
                df4Cover = " dd.MM."
                break;

              case "garfield":
              case "garfield_en":
              case "garfield-en":
              case "garfielden":
                comic = "garfield"
                coverFileName = comic + "_cover.raw"
                coverURL = "https://www.tierwelt.ch/sites/default/files/styles/header_news_2x/public/images/garfield.jpg"
                comicFileNamePrefix = comic + "_daily_"
                comicFileNameSuffix = ".raw"
                comicCoverURL = "https://www.gocomics.com/garfield/"  // only for cover. The pics get URL from complete comic image
                numRows = 1
                numCols = 3
                preLoadDays = 0  // no upcoming comics available 
                // next 4 values are obsolete, as image size and position is hardcoded
                spacerFactor = 20.0 / 280.0 // spacer to the next pic (values are taken from a real pic)
                blackBorderFactor = 3.0 / 280.0
                spacerHeight4CoverSmall = 150
                spacerHeight4CoverLarge = 300
                font4CoverSmall = Font.semiboldSystemFont(10) 
                font4CoverLarge = Font.semiboldSystemFont(20) 
                fontColor4Cover = Color.orange()
                df4Cover = "dd.MM.yyyy"
                break;

              case "dilbert_en":
              case "dilbert-en":
              case "dilberten":
                // as english version is similar to the german one, only some of the values have to be changed
                comic = "dilbert_en"
                comicFileNamePrefix = "dilbert_en_daily_"
                comicCoverURL = "https://dilbert.com"  // only for cover. The pics get URL from complete comic image
                break;
                
              case "dilbert_de":
              case "dilbert-de":
              case "dilbertde":
              case "dilbert":
                // nothing to change
                break;
             default:    
              
            }
        }
        if (parCount > 2) {
            DEBUG = (wParameter[2].indexOf("debug") >= 0)
        }
        if (parCount > 3) {
            forceDownload = (wParameter[3] == "force")
        }

        return wParameter.length
    } else {
        // settings for non configured widget 
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
        doNotDelete.push(getDailyLocalFileName(addDay(today, i)))
    }

    // get directory content
    let dirContent = fm.listContents(dir)
    for (i = 0; i < dirContent.length; i++) {
        if (fm.fileName(dirContent[i]).indexOf(comicFileNamePrefix) >= 0 || fm.fileName(dirContent[i], true).indexOf(coverFileName) >= 0) {
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
                    await debug_print_async ("fail rm " + fm.fileName(dirContent[i], true));
                }
            }
        }
    }
}

//- ised to delete dilbert jpg-files. (stored as .raw files now)
async function hardCleanLocalDir () {
  //let fm = FileManager.local()
  let dir = fm.documentsDirectory()
  let path

  // get directory content
  let dirContent = fm.listContents(dir)
  await debug_print_async("dir: " + dirContent.length);
  for (i=0; i<dirContent.length; i++) {
    await debug_print_async("rm check " + fm.fileName(dirContent[i], true));
    if ( fm.fileName(dirContent[i]).indexOf("dilbert_") >= 0 /*&& fm.fileName(dirContent[i], true).indexOf(".jpg") >= 0 */ ) {
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


async function loadImage(imgUrl) {
    const req = new Request(imgUrl)
    let rawData = await req.load();
    let isImage = Image.fromData(rawData)
    
    if (isImage) {
      await debug_print_async("is img " + imgUrl);
      return rawData
    } else {
      await debug_print_async("no img " + imgUrl);
      return null // return null, if response can not be interpreted as image
    }
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
    if (iDEBUG && comic == "dilbert_de") {
      let dir = ifm.documentsDirectory()
      let path = ifm.joinPath(dir, iDebugConsole)
      let dfTimestamp = dfCreateAndInit("yyyy-MM-dd HH:mm:ss.SSS")
      let now = new Date()
      let debug_output = ""
      
      try { await ifm.downloadFileFromiCloud(path); } catch (e) {}
      try { debug_output = await ifm.readString(path); } catch (e) {}
      debug_output =  dfTimestamp.string(now) + " " + text + "\n" + debug_output
      try { await ifm.writeString(path, debug_output); } catch (e) {}
    }

    if (DEBUG) {
      let debugRow = widget.addStack()
      let debugText = debugRow.addText(text)
      debugText.font = Font.mediumSystemFont(8)
      debugText.textColor = Color.blue()
    }
}

// We must notify caller that script ended
Script.complete();


//EOF
