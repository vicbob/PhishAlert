// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

let changeColor = document.getElementById('changeColor');

// chrome.storage.sync.get('color', function(data) {
//   changeColor.style.backgroundColor = data.color;
//   changeColor.setAttribute('value', data.color);
// });

let tabId;
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  tabId = tabs[0].id;
});

//Code to access DOM
const code = `(function getUrls(){
  let  elements = document.styleSheets;
  let  links = [];
  for (let  i=0;i<elements.length;i++){
    href = elements[i].href;
    if(href!=null && href!=""){
    links.push(href);
    }
  }

  elements = document.links;
  let  a = [];
  for (let  i=0;i<elements.length;i++){
    href = elements[i].href;
    if(href!=null && href!=""){
      a.push(href);
    }
  }

  elements = document.images;
  let  images = [];
  for (let  i=0;i<elements.length;i++){
    src = elements[i].src;
    if(src!=null && src!=""){
      images.push(src);
    }
  }

  elements = document.scripts;
  let  scripts = [];
  for (let  i=0;i<elements.length;i++){
    src = elements[i].src;
    if(src!=null && src!=""){
      scripts.push(src);
    }
  }

  const url = window.location.href;
  return { url,a, links,scripts,images};
})()`;

// IP address
let feature1 = function (url) {
  let start = url.indexOf("://") + 3;
  if (isNaN(Number(url[start]))) {
    return 0;
  }
  else {
    return 1;
  }
}

// SSl security
let feature2 = function (url) {
  if (url.startsWith("https")) {
    return 1
  }
  else {
    return 0
  }
}

// Number of dots
let feature3 = function (url) {
  let count = 0;
  for (let i = 0; i < url.length; i++) {
    if (url[i] == ".") {
      count++;
    }
  }
  return count;
}

// length of host
let feature4 = function (url) {
  let start = url.indexOf("://") + 3;
  let end = url.substring(start).indexOf("/")
  if (end == -1) {
    return url.substring(start).length;
  }
  else {
    return end;
  }
}

// length of file
let feature5 = function (url) {
  let fileStart = feature4(url) + url.indexOf("://") + 1 + 3;
  let end = url.indexOf('?');
  if (end == -1) {
    return url.substring(fileStart).length;
  }
  return end - fileStart;
}

let feature6 = function (url) {
  let queryStart = url.indexOf('?') + 1;
  if (queryStart == 0) {
    return 0;
  }
  return url.length - queryStart;
}

let levenshtein = function (str1, str2) {
  str1 = String(str1).toLowerCase();
  str2 = String(str2).toLowerCase();
  let matrix = []

  // populate matrix with 0
  for (let i = 0; i < str1.length + 1; i++) {
    let row = []
    for (let j = 0; j < str1.length + 1; j++) {
      row.push(0);
    }
    matrix.push(row);
  }

  for (let x = 0; x < str1.length + 1; x++) {
    matrix[x][0] = x
  }
  for (let y = 0; y < str2.length + 1; y++) {
    matrix[0][y] = y
  }

  for (let x = 1; x < str1.length + 1; x++) {
    for (let y = 1; y < str2.length + 1; y++) {
      if (str1[x - 1] == str2[y - 1]) {
        matrix[x][y] = Math.min(
          matrix[x - 1][y] + 1,
          matrix[x - 1][y - 1],
          matrix[x][y - 1] + 1
        );
      }
      else {
        matrix[x][y] = Math.min(
          matrix[x - 1][y] + 1,
          matrix[x - 1][y - 1] + 1,
          matrix[x][y - 1] + 1
        );
      }
    }
  }
  return matrix[str1.length][str2.length];
}

// Get domain
let getDomain = function (url) {
  url = String(url);
  if (url.startsWith("www")) {
    let start = 0;
    let end = url.substring(start).indexOf("/");
    if (end == -1) {
      return url.substring(start);
    }
    return url.substring(start, start + end);
  }
  // mail url
  let start = url.indexOf("@") + 1
  if (start != 0) {
    return url.substring(start);
  }

  start = url.indexOf("://") + 3
  if (start != 2) {
    let end = url.substring(start).indexOf("/");
    if (end == -1) {
      return url.substring(start);
    }
    return url.substring(start, start + end);
  }

  if (url.trim() == "") {
    return url;
  }

  // relative url
  else {
    return 0;
  }
}

let resourceDomainDifference = function (url, links) {
  try {
    if(links.length == 0) {
      return -1;
    }

    let tempLinks = links
    links = []
    for (let link of tempLinks) {
      if (!link.startsWith("#") && !link.startsWith("tel:") && !link.startsWith("javascript:") && !link.startsWith("data:")) {
        links.push(link);
      }
    }

    url = getDomain(url)
    let sumNormalizedLinkDifference = 0
    for (let link of links) {
      link = getDomain(link)
      // relative link
      if (link == 0) {
        link = url;
        continue;
      }
      let ldNormalized = (levenshtein(link, url)) / Math.max(url.length, link.length);
      sumNormalizedLinkDifference += ldNormalized;
    }

    let result = sumNormalizedLinkDifference / links.length;
    if (result == NaN) {
      return -1;
    }
    return result
  } catch (error) {
    console.log("In catch");
    return -1;
  }
}

let getProtocol = function (link, url) {
  link = String(link);
  if (link.startsWith("//") || link.startsWith("https:")) {
    return 1;
  }
  else if (link.startsWith("http:") || link.startsWith("www")) {
    return 0;
  }
  else if (link.startsWith("mailto:")) {
    let start = link.indexOf("@") + 1
    if (start != 0) {
      return getProtocol(link.substring(start), url);
    }
  }
  else {
    return feature2(url);
  }
}

let resourceAccessProtocol = function (url, links) {
  if(links.length == 0) {
    return -1;
  }
  let tempLinks = links;
  links = [];
  for (let link of tempLinks) {
    if (!link.startsWith("#") && !link.startsWith("tel:") && !link.startsWith("javascript:") && !link.startsWith("data:")) {
      links.push(link);
    }
  }

  let protocolSum = 0;
  for (let link of links) {
    let protocol = getProtocol(link, url);
    protocolSum += protocol;
  }

  let result = protocolSum / links.length;
  return result
}

let classify = function (instance) {
  try {


    if (instance[13] <= -0.5 && instance[4] > 0.5 && instance[7] <= 0.95 && instance[8] <= 0.062 && instance[3] > 9.5) {
      return (1);
    }

    if (instance[13] > -0.5 && instance[2] > 3.5) {
      return (1);
    }

    if (instance[12] > 0.0528 && instance[2] > 3.5) {
      return (1)
    }

    if (instance[4] <= 0.5 && instance[10] <= 0.0172 && instance[1] <= 0.5 && instance[7] <= -0.5) {
      return (1)
    }

    if (instance[13] <= 0.0078) {
      if (instance[8] > 0.0662) {
        if (instance[6] > 0.1663) {
          if (instance[5] > 15.5) {
            return (1)
          }
        }
      }
    }

    if (instance[13] <= -0.5) {
      if (instance[4] > 0.5) {
        if (instance[7] <= 0.95) {
          if (instance[8] <= 0.062) {
            if (instance[3] <= 9.5) {
              return (1)
            }
          }
        }
      }
    }

    if (instance[13] > 0.0078)
      if (instance[2] <= 3.5)
        if (instance[5] > 34.5)
          if (instance[7] > 0.3061)
            return (1)

    if (instance[13] <= 0.0078)
      if (instance[8] > 0.0662)
        if (instance[6] <= 0.1663)
          if (instance[4] <= 21.0)
            if (instance[8] <= 0.3999)
              return (0)

    if (instance[13] <= -0.5)
      if (instance[4] > 0.5)
        if (instance[7] <= 0.95)
          if (instance[8] > 0.062)
            if (instance[12] > 0.0742)
              return (1)

    if (instance[8] > 0.0173)
      if (instance[2] <= 3.5)
        if (instance[6] > 0.3135)
          if (instance[7] > 0.6749)
            return (1)

    if (instance[13] > -0.5)
      if (instance[5] <= 34.5)
        if (instance[10] <= 0.0154)
          if (instance[6] <= 0.7907)
            return (1)

    if (instance[13] > -0.5)
      if (instance[5] > 34.5)
        if (instance[2] <= 3.5)
          if (instance[6] <= 0.2572)
            if (instance[8] > 0.0216)
              return (0)

    if (instance[13] > -0.5)
      if (instance[2] <= 3.5)
        if (instance[10] > 0.0154)
          if (instance[6] > 0.3114)
            if (instance[5] > 33.5)
              return (1)

    if (instance[12] <= 0.0528)
      if (instance[4] <= 0.5)
        if (instance[1] <= 0.5)
          if (instance[11] > -0.5)
            if (instance[2] > 1.5)
              return (0)

    if (instance[4] <= 0.5)
      if (instance[10] <= 0.0172)
        if (instance[1] > 0.5)
          if (instance[2] <= 1.5)
            return (1)

    if (instance[13] <= 0.0078)
      if (instance[4] > 0.5)
        if (instance[8] <= 0.0662)
          if (instance[7] <= 0.95)
            if (instance[3] <= 9.5)
              return (1)

    if (instance[13] <= 0.0078)
      if (instance[8] <= 0.0662)
        if (instance[4] <= 0.5)
          if (instance[1] > 0.5)
            if (instance[3] > 26.0)
              return (1)

    if (instance[13] > 0.0078)
      if (instance[5] > 34.5)
        if (instance[2] <= 3.5)
          if (instance[6] <= 0.2572)
            if (instance[8] <= 0.0216)
              return (1)

    if (instance[13] <= -0.5)
      if (instance[4] <= 0.5)
        if (instance[1] <= 0.5)
          if (instance[11] <= -0.5)
            return (1)

    if (instance[12] <= 0.0528)
      if (instance[4] > 0.5)
        if (instance[7] > 0.95)
          return (0)

    if (instance[4] <= 0.5)
      if (instance[10] <= 0.0172)
        if (instance[1] <= 0.5)
          if (instance[7] > -0.5)
            if (instance[2] <= 1.5)
              return (1)

    if (instance[4] <= 0.5)
      if (instance[10] > 0.0172)
        if (instance[5] <= 34.0)
          if (instance[6] > 0.6953)
            return (1)

    if (instance[4] > 0.5)
      if (instance[9] > 0.9583)
        return (0)

    if (instance[12] <= 0.0528)
      if (instance[4] > 0.5)
        if (instance[7] <= 0.95)
          if (instance[9] <= 0.9167)
            if (instance[3] > 10.5)
              return (1)

    if (instance[13] > -0.5)
      if (instance[5] <= 34.5)
        if (instance[10] > 0.0154)
          if (instance[6] <= 0.6093)
            if (instance[2] <= 4.0)
              return (0)

    if (instance[4] <= 0.5)
      if (instance[10] > 0.0172)
        if (instance[5] <= 34.0)
          if (instance[6] <= 0.6953)
            return (0)

    if (instance[13] > 0.0078)
      if (instance[2] <= 3.5)
        if (instance[5] <= 34.5)
          if (instance[11] > -0.5)
            if (instance[0] <= 0.5)
              return (0)

    if (instance[13] <= -0.5)
      if (instance[4] <= 0.5)
        if (instance[1] > 0.5)
          if (instance[2] > 1.5)
            if (instance[5] <= 35.5)
              return (0)
  } catch (error) {
    console.log("error is", error);
  }
}


$(document).ready(async function () {
  $('#spin').hide();
  $('#positive-result').hide();
  $('#negative-result').hide();

  $('#analyze').click(async function () {
    console.log("I was clicked");
    $('#start').hide();
    $('#spin').show();

    // get the DOM resources
    const getDom = ms => new Promise(
      resolve => chrome.tabs.executeScript(tabId, { code }, async function (result) {
        console.log("returned is",result[0]);
        resolve(result[0]);
      }))
    getDom().then((result) => {
      console.log(result)
      const { url, a, links, scripts, images } = result;
      let instance = []
      instance.push(feature1(url));
      instance.push(feature2(url));
      instance.push(feature3(url));
      instance.push(feature4(url));
      instance.push(feature5(url));
      instance.push(feature6(url));

      instance.push(resourceDomainDifference(url, a));
      instance.push(resourceDomainDifference(url, links));
      instance.push(resourceDomainDifference(url, scripts));
      instance.push(resourceDomainDifference(url, images));

      instance.push(resourceAccessProtocol(url, a));
      instance.push(resourceAccessProtocol(url, links));
      instance.push(resourceAccessProtocol(url, scripts));
      instance.push(resourceAccessProtocol(url, images));

      // classify webpage
      let classification = classify(instance);
      console.log(instance);
      console.log(classification);
      $('#spin').hide();
      if (classification == 1) {
        $('#negative-result').show();
      }
      else {
        $('#positive-result').show();
      }
    })
    //extract features


  });
});
