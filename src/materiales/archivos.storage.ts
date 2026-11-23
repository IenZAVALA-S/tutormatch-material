import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo, Types } from 'mongoose';

/**
 * Guarda los bytes de los archivos en GridFS, bucket "archivos"
 * (colecciones archivos.files y archivos.chunks). El documento de materiales
 * solo guarda el gridfsId: un documento de Mongo no puede pasar de 16 MB.
 */
@Injectable()
export class ArchivosStorage {
  constructor(@InjectConnection() private readonly conexion: Connection) {}

  async guardar(nombre: string, datos: Buffer): Promise<Types.ObjectId> {
    const subida = this.bucket().openUploadStream(nombre);
    await new Promise<void>((resolve, reject) => {
      subida.once('finish', resolve).once('error', reject);
      subida.end(datos);
    });
    return subida.id;
  }

  async leer(gridfsId: Types.ObjectId): Promise<Buffer> {
    const partes: Buffer[] = [];
    for await (const parte of this.bucket().openDownloadStream(gridfsId)) {
      partes.push(parte as Buffer);
    }
    return Buffer.concat(partes);
  }

  async borrar(gridfsId: Types.ObjectId): Promise<void> {
    await this.bucket().delete(gridfsId);
  }

  // Se crea en cada uso: conexion.db solo existe una vez conectado a Mongo.
  private bucket(): mongo.GridFSBucket {
    return new mongo.GridFSBucket(this.conexion.db!, {
      bucketName: 'archivos',
    });
  }
}
