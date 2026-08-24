/**
 * Ponto de entrada do Web App.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('BEEP Remunera')
    .setFaviconUrl('https://www.gstatic.com/images/icons/material/system/2x/badge_googg_128dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Usado pelos templates HTML para compor a página a partir de arquivos parciais. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
