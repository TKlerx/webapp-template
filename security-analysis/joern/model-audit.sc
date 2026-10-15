import io.shiftleft.semanticcpg.language.*
@main def exec(cpgFile: String, outFile: String) = {
  importCpg(cpgFile)
  val calls = cpg.call.name("execSync|execFileSync|run|<operator>.fieldAccess|<operator>.indexAccess").l
  val data = ujson.Obj(
    "imports" -> ujson.Arr.from(cpg.imports.l.map(i => ujson.Obj("code" -> i.code, "entity" -> i.importedEntity.getOrElse(""), "as" -> i.importedAs.getOrElse("")))),
    "calls" -> ujson.Arr.from(calls.map(c => ujson.Obj("name" -> c.name, "full" -> c.methodFullName, "code" -> c.code, "file" -> c.file.name.headOption.getOrElse(""), "args" -> ujson.Arr.from(c.argument.l.map(a => ujson.Obj("code" -> a.code, "index" -> a.argumentIndex, "name" -> a.argumentName.getOrElse("")))))))
  )
  java.nio.file.Files.writeString(java.nio.file.Path.of(outFile), ujson.write(data, indent=2))
}
