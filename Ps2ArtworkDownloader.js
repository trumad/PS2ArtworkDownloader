// ==UserScript==
// @name         PS2 Artwork Downloader
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Batch downloads Playstation 2 game artwork, covers, disc art, screenshots and background shots for use with Open Playstation 2 Loader
// @include     http://oplmanager.no-ip.info/site/?gamelist*
// @author       Than
// @grant       GM.xmlHttpRequest
// @grant       GM_download
// @run-at      document-body
// ==/UserScript==

(function() {
    'use strict';
//Let's go:

    //Function to parse XML data to make an object out of it:
   function parseXml(xml, arrayTags)
{
    var dom = null;
    if (window.DOMParser)
    {
        dom = (new DOMParser()).parseFromString(xml, "text/xml");
    }
    else if (window.ActiveXObject)
    {
        dom = new ActiveXObject('Microsoft.XMLDOM');
        dom.async = false;
        if (!dom.loadXML(xml))
        {
            throw dom.parseError.reason + " " + dom.parseError.srcText;
        }
    }
    else
    {
        throw "cannot parse xml string!";
    }

    function isArray(o)
    {
        return Object.prototype.toString.apply(o) === '[object Array]';
    }

    function parseNode(xmlNode, result)
    {
        if (xmlNode.nodeName == "#text") {
            var v = xmlNode.nodeValue;
            if (v.trim()) {
               result['#text'] = v;
            }
            return;
        }

        var jsonNode = {};
        var existing = result[xmlNode.nodeName];
        if(existing)
        {
            if(!isArray(existing))
            {
                result[xmlNode.nodeName] = [existing, jsonNode];
            }
            else
            {
                result[xmlNode.nodeName].push(jsonNode);
            }
        }
        else
        {
            if(arrayTags && arrayTags.indexOf(xmlNode.nodeName) != -1)
            {
                result[xmlNode.nodeName] = [jsonNode];
            }
            else
            {
                result[xmlNode.nodeName] = jsonNode;
            }
        }

        if(xmlNode.attributes)
        {
            var length = xmlNode.attributes.length;
            for(var i = 0; i < length; i++)
            {
                var attribute = xmlNode.attributes[i];
                jsonNode[attribute.nodeName] = attribute.nodeValue;
            }
        }

        var length = xmlNode.childNodes.length;
        for(var i = 0; i < length; i++)
        {
            parseNode(xmlNode.childNodes[i], jsonNode);
        }
    }
    var result = {};
    if(dom.childNodes.length)
    {
        parseNode(dom.childNodes[0], result);
    }

    return result;
}

    //the opening & closing data is wrapped around the XML for all the games we'll be requesting from the server
    var openingData = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><ArtSearchBatch xmlns="http://oplmanager.no-ip.info/" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><userID>0</userID><games>`;
    var closingData = `</games></ArtSearchBatch></s:Body></s:Envelope>`;

    //When given the finalXML data containing the game IDs, send the post request to get the list of URLs for all the images related to each game
    function getImageUrls(finalXML){
        GM.xmlHttpRequest({
            method: "POST",
            url: "http://oplmanager.no-ip.info/API/V5/OplManagerService.asmx",
            data: openingData + finalXML + closingData,
            headers: {
                "Content-Type": "text/xml; charset=utf-8",
                "User-Agent": "OPL-Manager/21.3",
                "SOAPAction": "http://oplmanager.no-ip.info/ArtSearchBatch",
                "Host": "oplmanager.no-ip.info",
                "Expect": "100-continue",
                "Accept-Encoding": "gzip, deflate",
                "Connection": "Keep-Alive",
            },
            onload: function(response) {
                console.log(response.responseText);
                var jpegList = response.responseText.match(/<ArtSearchBatchResult>[\s\S]+<\/ArtSearchBatchResult>/);
             //  console.log( parseXml(jpegList)); // wow this is a good result
                var resultsObject = parseXml(jpegList); // Turn the awful XML into a nice JS Object
                indexDownloadUrls(resultsObject); // Create another object with just the filename/URL as key/value pairs
              
  }
        });
    }

    var finalXML = "";

    //Function to insert a character at a certain index in a string
    String.prototype.insert = function(what, index) {
        return index > 0
        ? this.replace(new RegExp('.{' + index + '}'), '$&' + what)
    : what + this;
    };

    function gameIdToXmlFormat(gameId){ // changes SLUS-20945 into SLUS_209.45
    var xmlGameId = gameId.replace("-","_");
        xmlGameId = xmlGameId.insert(".",8);
        return xmlGameId;
    }

    function generateGameIdXml(gameId){ // creates the XML for each game
    var xmlGameId = `<ArtSearchBatchRequestClass><GameID>`+gameIdToXmlFormat(gameId)+`</GameID><GameType>PS2</GameType></ArtSearchBatchRequestClass>`;
        return xmlGameId;
    }

    //grabs game IDs from the pages (eg http://oplmanager.no-ip.info/site/?gamelist&l=A)
    var as = document.getElementsByClassName("table table-striped table-bordered ")[0];
    for(var i=0;i<as.rows.length;i++) {
        var trs = as.getElementsByTagName("tr")[i];
        var cellVal=trs.cells[0].textContent;
        finalXML = finalXML + generateGameIdXml(cellVal);
    }

    console.log(finalXML);

    //send a request to the server to get the image urls for all these games
    getImageUrls(finalXML);



    function indexDownloadUrls(resultsObject){
        // generate key/pairs for filename/urls & push to urlList object
        function generateSingleKeyPair(id,identifier,url,extension){
            if (url){
            var key = id+ identifier + extension;
            var value = url;
            urlList[key] = value;}
        }
        var gameListArray = resultsObject.ArtSearchBatchResult.GameART;
        var urlList = {};
        for(var i=0;i<gameListArray.length;i++) { // for every game:
            var id = gameListArray[i].ID['#text'];
           // console.log(id);
            generateSingleKeyPair(id,"_COV",gameListArray[i].COV['#text'],gameListArray[i].ExCOV['#text']);
            generateSingleKeyPair(id,"_COV2",gameListArray[i].COV2['#text'],gameListArray[i].ExCOV2['#text']);
            generateSingleKeyPair(id,"_ICO",gameListArray[i].ICO['#text'],gameListArray[i].ExICO['#text']);
            generateSingleKeyPair(id,"_LAB",gameListArray[i].LAB['#text'],gameListArray[i].ExLAB['#text']);
            generateSingleKeyPair(id,"_LGO",gameListArray[i].LGO['#text'],gameListArray[i].ExLGO['#text']);
            if (gameListArray[i].BG.string){ // there can be multiple background images
              //  console.log(id + " BG is Array: "+Array.isArray(gameListArray[i].BG.string));
                if (Array.isArray(gameListArray[i].BG.string)){
                    for(var j=0;j<gameListArray[i].BG.string.length;j++) {
                        var iteration = "";
                        if (j === 0){iteration = "";}
                        if (j > 0){iteration = j+1;}
                        generateSingleKeyPair(id,"_BG"+iteration,gameListArray[i].BG.string[j]['#text'],".jpg");
                    }
                }
                else {
                    console.log(id + " URL:"+gameListArray[i].BG.string["#text"]);
                    generateSingleKeyPair(id,"_BG",gameListArray[i].BG.string["#text"],".jpg");
                }
            }
            if (gameListArray[i].SCR.string){ // there can be multiple screenshots
              //  console.log(id + " SCR is Array: "+Array.isArray(gameListArray[i].SCR.string));
                if (Array.isArray(gameListArray[i].SCR.string)){
                    for(var j=0;j<gameListArray[i].SCR.string.length;j++) {
                        var iteration = "";
                        if (j === 0){iteration = "";}
                        if (j > 0){iteration = j+1;}
                        generateSingleKeyPair(id,"_SCR"+iteration,gameListArray[i].SCR.string[j]['#text'],".jpg");
                    }
                }
                else {
                    console.log(id + " URL:"+gameListArray[i].SCR.string["#text"]);
                    generateSingleKeyPair(id,"_SCR",gameListArray[i].SCR.string["#text"],".jpg");
                }
            }
        }
       // console.log(urlList);
        download(urlList); // let's download them!
    }


    //go!
    function download(urlList){
        console.log(urlList);
        var filenamesArray = Object.keys(urlList);
        var numberOfFiles = filenamesArray.length;
        console.log(numberOfFiles);
        var iteration = 0;
        getIt(iteration);
        function getIt(num){
            GM_download({
                name: filenamesArray[num],
                url: urlList[filenamesArray[num]],
                onload: function() {
                    console.log(filenamesArray[num], ' success: ', urlList[filenamesArray[num]], arguments);
                    if (iteration <= numberOfFiles){
                        console.log(numberOfFiles-iteration + " to go");
                        iteration++;
                        getIt(iteration);}
                },
                onerror: function() {
                    console.warn(filenamesArray[num], ' Error, trying again: ', urlList.filenamesArray[num], arguments);
                    getIt(num);
                },
                ontimeout: function() {
                    console.warn(filenamesArray[num], ' Timeout, trying again: ', urlList.filenamesArray[num], arguments);
                    getIt(num);
                }
            });
        }

    }



    //End of script:
})();



