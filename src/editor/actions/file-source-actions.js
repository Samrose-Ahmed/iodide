import {
  saveFileSourceToServer,
  deleteFileSourceFromServer
} from "../../shared/utils/file-source-operations";

const FREQUENCY_OPTIONS = {
  never: undefined,
  daily: "1 day, 0:00:00",
  weekly: "7 days, 0:00:00"
};

export function addFileSource(
  sourceURL,
  destinationFilename,
  frequency = undefined
) {
  return async (dispatch, getState) => {
    const notebookID = getState().notebookInfo.notebook_id;
    const convertedFrequency = FREQUENCY_OPTIONS[frequency];
    const response = await saveFileSourceToServer(
      notebookID,
      sourceURL,
      destinationFilename,
      convertedFrequency
    );

    const fileSourceID = response.id;

    dispatch({
      type: "ADD_FILE_SOURCE_TO_NOTEBOOK",
      sourceURL,
      fileSourceID,
      destinationFilename,
      frequency
    });
    return response;
  };
}

export function deleteFileSource(fileSourceID) {
  return async dispatch => {
    const response = await deleteFileSourceFromServer(fileSourceID);
    // remove the listed file source from notebook.
    dispatch({
      type: "DELETE_FILE_SOURCE_FROM_NOTEBOOK",
      fileSourceID
    });
    return response;
  };
}
