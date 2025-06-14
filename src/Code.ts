/*
const storage = PropertiesService.getScriptProperties();

// Handle GET, POST, and DELETE requests
function doGet(e) {
    const action = e.parameter.action;
    if (action === 'updateDuration') {
        const key = e.parameter.key;
        const value = e.parameter.value;
        var dur = JSON.parse(storage.getProperty('duration') || '{"focus":1500,"break":300,"longBreak":900}');
        dur[key] = value;
        storage.setProperty('duration', JSON.stringify(dur));

        return ContentService.createTextOutput("Done").setMimeType(ContentService.MimeType.TEXT);
    }

    else if (action === 'incrementHistory') {
        const key = e.parameter.key;
        const value = e.parameter.value;
        var dur = JSON.parse(storage.getProperty('history') || '{}');
        if (!dur[key]) {
            dur[key] = parseInt(value); // Initialize if key does not exist
        }
        else{
        dur[key] = parseInt(dur[key])+parseInt(value);
        }
        storage.setProperty('history', JSON.stringify(dur));

        return ContentService.createTextOutput("Done").setMimeType(ContentService.MimeType.TEXT);
    }
    else if (action === 'getHistory') {
        return ContentService.createTextOutput(storage.getProperty('history') || '{}').setMimeType(ContentService.MimeType.JSON);
    }
    else if (action === 'getAllDurations') {
        return ContentService.createTextOutput(storage.getProperty('duration') || '{"focus":1500,"break":300,"longBreak":900}').setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput("Invalid request.").setMimeType(ContentService.MimeType.TEXT);

}

*/