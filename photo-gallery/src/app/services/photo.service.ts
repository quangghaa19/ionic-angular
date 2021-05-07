import { Injectable } from '@angular/core';
import { Plugins, CameraResultType, Capacitor, FilesystemDirectory,
        CameraPhoto, CameraSource } from '@capacitor/core'; 
import { Platform } from '@ionic/angular';

const { Camera, Filesystem, Storage } = Plugins;

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  // to hold taken photos
  public photos: Photo[] = [];

  // For Display photos
  private PHOTO_STORAGE: string = "photos";

  // On mobile
  private platform: Platform;

  constructor() { }

  public async addNewToGallery() {
    // Take a photo
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri, // file-based datas, provides best performance
      source: CameraSource.Camera, // automatically take a new photo with the camera
      quality: 100 // highest quality (0-100)
    });

    // Save to array
    // this.photos.unshift({
    //   filepath: "soon...", 
    //   webviewPath: capturedPhoto.webPath
    // });

    // Save the picture and add it to the collection
    const savedImageFile = await this.savePicture(capturedPhoto);
    this.photos.unshift(savedImageFile);

    // To save the photos array
    Storage.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    });
  }

  // Save to filesystem
  // cameraPhoto represents the newly captured photo
  private async savePicture(cameraPhoto: CameraPhoto) {
    // Convert photo to base64 format, required by Filesystem API to save
    const base64Data = await this.readAsBase64(cameraPhoto);

    // Write the file to the data directory
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data
    });

    // Change to support mobile
    if(this.platform.is('hybrid')) {
      // Display the new image by writing  the 'file:// ' path to HTTP
      // Details: https://ionicframework.com/docs/building/webview#file-protocol
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri)
      }
    } else {
      // Use webpath to display the image instead of base64 since it's
      // already loaded into memory
      return {
        filepath: fileName,
        webviewPath: cameraPhoto.webPath
      }
    }
  }

  // Helper method
  // Change to support mobile
  private async readAsBase64(cameraPhoto: CameraPhoto) {
    // "hybrid" will detect Cordova or Capacitor
    if(this.platform.is('hybrid')) {
      // Read the file into base64 format
      const file = await Filesystem.readFile({
        path: cameraPhoto.path
      });

      return file.data;
    } else {
      // Fetch the photo, read as a blob, then convert to base64 format
      const response = await fetch(cameraPhoto.webPath);
      const blob = await response.blob();

      return await this.convertBlobToBase64(blob) as string;
    }
  } 

  convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader;
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    }
    reader.readAsDataURL(blob);
  });

  public async loadSaved() {
    // Retrieve cached photo array data
    const photoList = await Storage.get({ key: this.PHOTO_STORAGE });
    this.photos = JSON.parse(photoList.value) || [];

    // Easiest way to detect when running on the web:
    // When the platform is not hybrid, do this:
    if(!this.platform.is('hybrid')) {
      // Display the photo by reading into base64 format
      for(let photo  of this.photos) {
        // Read each saved photo's data from the Filesystem
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: FilesystemDirectory.Data
        });
        // Web platform only load photo as base64 data
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
  }
}

export interface Photo {
  filepath: string;
  webviewPath: string;
}
