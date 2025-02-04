import * as path from 'path';

const assetsPath = path.resolve(__dirname, 'logos');

export const logos = { // Based on this list @see http://stackoverflow.com/a/4212908/2299554
    'default': assetsPath + '/none.png',
    'default_image': assetsPath + '/image.png',

    // Video Files

    'video/mp4': assetsPath + '/video.png',
    'video/x-flv': assetsPath + '/video.png',
    'video/webm': assetsPath + '/video.png',
    'application/x-mpegURL': assetsPath + '/video.png',
    'video/MP2T': assetsPath + '/video.png',
    'video/3gpp': assetsPath + '/video.png',
    'video/quicktime': assetsPath + '/video.png',
    'video/x-msvideo': assetsPath + '/video.png',
    'video/x-ms-wmv': assetsPath + '/video.png',



    // // Microsoft Word
    // 'application/msword' :  assetsPath +'/word.png',
    // 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :  assetsPath +'/word.png',
    // 'application/vnd.openxmlformats-officedocument.wordprocessingml.template' :  assetsPath +'/word.png',
    // 'application/vnd.ms-word.document.macroEnabled.12' :  assetsPath +'/word.png',

    // // Microsoft Excel
    // 'application/vnd.ms-excel' :  assetsPath +'/excel.png',
    // 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :  assetsPath +'/excel.png',
    // 'application/vnd.openxmlformats-officedocument.spreadsheetml.template' :  assetsPath +'/excel.png',
    // 'application/vnd.ms-excel.sheet.macroEnabled.12' :  assetsPath +'/excel.png',
    // 'application/vnd.ms-excel.template.macroEnabled.12' :  assetsPath +'/excel.png',
    // 'application/vnd.ms-excel.addin.macroEnabled.12' :  assetsPath +'/excel.png',
    // 'application/vnd.ms-excel.sheet.binary.macroEnabled.12' :  assetsPath +'/excel.png',

    // // Microsoft Power Point
    // 'application/vnd.ms-powerpoint' :  assetsPath +'/ppt.png',
    // 'application/vnd.openxmlformats-officedocument.presentationml.presentation' :  assetsPath +'/ppt.png',
    // 'application/vnd.openxmlformats-officedocument.presentationml.template' :  assetsPath +'/ppt.png',
    // 'application/vnd.openxmlformats-officedocument.presentationml.slideshow' :  assetsPath +'/ppt.png',
    // 'application/vnd.ms-powerpoint.addin.macroEnabled.12' :  assetsPath +'/ppt.png',
    // 'application/vnd.ms-powerpoint.presentation.macroEnabled.12' :  assetsPath +'/ppt.png',
    // 'application/vnd.ms-powerpoint.template.macroEnabled.12' :  assetsPath +'/ppt.png',
    // 'application/vnd.ms-powerpoint.slideshow.macroEnabled.12' :  assetsPath +'/ppt.png',

    // Adobe PDF
    // 'application/pdf' :  assetsPath +'/pdf.png',
};
