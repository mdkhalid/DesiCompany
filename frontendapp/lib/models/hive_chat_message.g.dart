// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'hive_chat_message.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class HiveChatMessageAdapter extends TypeAdapter<HiveChatMessage> {
  @override
  final int typeId = 0;

  @override
  HiveChatMessage read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return HiveChatMessage(
      id: fields[0] as String,
      content: fields[1] as String,
      senderId: fields[2] as String,
      senderName: fields[3] as String,
      senderRole: fields[4] as String,
      messageType: fields[5] as String,
      metadata: (fields[6] as Map?)?.cast<String, dynamic>(),
      createdAt: fields[7] as DateTime?,
      status: fields[8] as String,
      isRead: fields[9] as bool,
      isPending: fields[10] as bool,
    );
  }

  @override
  void write(BinaryWriter writer, HiveChatMessage obj) {
    writer
      ..writeByte(11)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.content)
      ..writeByte(2)
      ..write(obj.senderId)
      ..writeByte(3)
      ..write(obj.senderName)
      ..writeByte(4)
      ..write(obj.senderRole)
      ..writeByte(5)
      ..write(obj.messageType)
      ..writeByte(6)
      ..write(obj.metadata)
      ..writeByte(7)
      ..write(obj.createdAt)
      ..writeByte(8)
      ..write(obj.status)
      ..writeByte(9)
      ..write(obj.isRead)
      ..writeByte(10)
      ..write(obj.isPending);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is HiveChatMessageAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
