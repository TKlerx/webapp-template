// SPDX-License-Identifier: MIT
// Adapted from GitHub CodeQL CommandInjection query/customization and process models.
// Copyright (c) 2006-2025 GitHub, Inc. See LICENSE-CodeQL and README.md.
// Bounded security models: HTTP/worker inputs to command, network, SQL, file,
// redirect, evaluation, deserialization and prototype-mutation sinks; secrets to logs.
import io.shiftleft.semanticcpg.language.*
import io.joern.dataflowengineoss.language.*
import io.shiftleft.codepropertygraph.generated.nodes.*
import io.joern.dataflowengineoss.DefaultSemantics
import io.joern.dataflowengineoss.semanticsloader.FlowSemantic
import io.joern.dataflowengineoss.semanticsloader.FlowPath.PassThroughMapping
import io.joern.dataflowengineoss.queryengine.EngineContext
import io.joern.dataflowengineoss.layers.dataflows.{OssDataFlow, OssDataFlowOptions}
import io.shiftleft.semanticcpg.layers.LayerCreatorContext

@main def commandInjection(cpgFile: String, outFile: String) = {
  importCpg(cpgFile)
  val language = cpg.metaData.language.head
  require(Set("JSSRC", "PYTHONSRC").contains(language), s"Unsupported language: $language")
  def file(node: AstNode): String = node.file.name.headOption.getOrElse("")
  def location(node: AstNode) = ujson.Obj("file" -> file(node), "line" -> node.lineNumber.getOrElse(-1), "code" -> node.code)

  // CodeQL uses framework/threat-model sources; port only the framework surfaces
  // exercised here. Parameter names alone never make all helper inputs tainted.
  val flaskRequests = cpg.imports.filter(_.importedEntity.contains("flask.request")).l
  val legacySources = cpg.call.name("<operator>.fieldAccess|<operator>.indexAccess").filter { call =>
    if (language == "JSSRC") {
      val root = call.code.takeWhile(_ != '.')
      Set("req", "request").contains(root) && call.method.parameter.nameExact(root).nonEmpty &&
        (!call.method.parameter.nameExact(root).exists(p => p.typeFullName.matches("(?:.*[.:])?(?:NextRequest|Request)")) ||
          cpg.imports.exists(i => file(i) == file(call) && i.importedEntity.exists(entity =>
            entity == "express:Request" || entity == "express-serve-static-core:Request"))) &&
        call.code.matches("(?:req|request)\\.(?:query|body|params|headers|cookies)(?:\\..+|\\[.+\\])")
    } else {
      flaskRequests.exists { requestImport =>
        file(requestImport) == file(call) && call.code.matches(
          java.util.regex.Pattern.quote(requestImport.importedAs.getOrElse("request")) +
          "\\.(?:args|form|values|json|headers|cookies)(?:\\..+|\\[.+\\])"
        )
      }
    }
  }.l

  // Next.js/Web Request inputs: model values returned by readers, not references
  // to get/trim methods. Type annotations anchor the receiver to a request.
  def requestNames(call: Call) = call.method.parameter.filter(p =>
    p.typeFullName.matches("(?:.*[.:])?(?:NextRequest|Request)") ||
      p.code.matches("(?s).*:\\s*(?:NextRequest|Request)\\b.*")
  ).name.l
  def isBodyHelper(call: Call) = Set("parseJsonBody", "parseFormBody").contains(call.name) &&
    cpg.imports.exists(i => file(i) == file(call) &&
      i.importedEntity.exists(entity => entity.endsWith(s"lib/validation:${call.name}")))
  val nextSources = if (language != "JSSRC") Nil else cpg.call.l.flatMap { call =>
    val names = requestNames(call)
    val reader = names.exists { name =>
      val receiver = java.util.regex.Pattern.quote(name)
      call.code.matches(receiver + "\\.(?:json|formData|text|arrayBuffer)\\(.*") ||
        call.code.matches(receiver + "\\.(?:headers|cookies)\\.(?:get|getAll)\\(.*") ||
        call.code.matches(receiver + "\\.nextUrl\\.searchParams\\.(?:get|getAll)\\(.*")
    }
    val url = call.name == "<operator>.fieldAccess" && names.exists(name => call.code == s"$name.url")
    val cookieValue = call.name == "<operator>.fieldAccess" && names.exists(name =>
      call.code.matches(java.util.regex.Pattern.quote(name) + "\\.cookies\\.get\\(.*\\)!?\\.value"))
    val routeParams = call.name == "<operator>.fieldAccess" && names.nonEmpty &&
      call.method.parameter.exists(p => p.code.contains("params") && call.code == s"${p.name}.params")
    val helper = isBodyHelper(call)
    val helperValue = call.name == "<operator>.fieldAccess" &&
      call.method.ast.isCall.name("<operator>.assignment").exists { assignment =>
        assignment.argument.filter(_.argumentIndex == 1).exists { target =>
          (call.code == s"${target.code}.data" || call.code.startsWith(s"${target.code}.data.")) &&
            assignment.argument.filter(_.argumentIndex == 2).ast.isCall.exists(isBodyHelper)
        }
      }
    if (reader && !call.name.startsWith("<operator>")) List((call, "nextjs.reader"))
    else if (cookieValue) List((call, "nextjs.cookie-value"))
    else if (url || routeParams) List((call, "nextjs.url-or-params"))
    else if (helper || helperValue) List((call, "nextjs.validated-body-helper"))
    else Nil
  }

  // BackgroundJob.payload is a trust boundary. Pydantic shape validation does
  // not sanitize shell commands. Other objects' payload fields are not sources.
  val workerSources = if (language != "PYTHONSRC") Nil else cpg.call.filter { call =>
    val root = call.code.takeWhile(_ != '.')
    val payloadRead = call.code == s"$root.payload" || call.code.startsWith(s"$root.payload[") ||
      (call.name == "get" && call.code.startsWith(s"$root.payload.get("))
    if (!payloadRead) false else {
      val assignments = call.method.ast.isCall.name("<operator>.assignment").l
      val typedJob = call.method.parameter.exists(p => p.name == root && p.typeFullName.endsWith("BackgroundJob"))
      val claimedJob = assignments.exists { assignment =>
        assignment.argument.exists(arg => arg.argumentIndex == 1 && arg.code == root) &&
          assignment.argument.filter(_.argumentIndex == 2).ast.isCall.exists { claim =>
            claim.name == "claim_next_job" && claim.argument.filter(_.argumentIndex == 0).exists { receiver =>
              call.method.parameter.exists(p => p.name == receiver.code && p.typeFullName.endsWith("JobStore")) ||
                assignments.exists { binding =>
                  binding.argument.exists(arg => arg.argumentIndex == 1 && arg.code == receiver.code) &&
                    binding.argument.filter(_.argumentIndex == 2).ast.isCall.exists(c =>
                      c.methodFullName.endsWith("db.py:<module>.JobStore.__init__"))
                }
            }
          }
      }
      typedJob || claimedJob
    }
  }.l.map(call => (call, "worker.job-payload"))
  val modeledSources = (legacySources.map(call => (call, "legacy.http")) ++ nextSources ++ workerSources)
    .groupBy(_._1.id).values.map(_.head).toList
  val sourceKinds = modeledSources.map { case (node, kind) => node.id -> kind }.toMap
  val sources = modeledSources.map(_._1)

  // Match imported APIs rather than every method named read/execute/redirect.
  // ponytail: namespace/import aliases are bounded; dynamic rebinding needs dedicated models.
  val importsByFile = cpg.imports.toList.groupBy(file)
  def api(call: Call, module: String, member: String): Boolean = {
    val normalized = module.stripPrefix("node:")
    val full = call.methodFullName.stripPrefix("node:")
    full == s"$normalized:$member" || importsByFile.getOrElse(file(call), Nil).exists { imported =>
      val entity = imported.importedEntity.getOrElse("").stripPrefix("node:")
      val alias = imported.importedAs.getOrElse("")
      file(imported) == file(call) && alias.nonEmpty && (
        ((entity == s"$normalized:$member" || entity == s"$normalized.$member") &&
          call.code.startsWith(s"$alias(")) ||
        ((entity == normalized || entity == s"$normalized:*" || entity == s"$normalized.<module>") &&
          call.code.startsWith(s"$alias.$member(")) ||
        (language == "PYTHONSRC" && (entity.startsWith(normalized) || entity == normalized.takeWhile(_ != '.')) &&
          call.code.startsWith(s"$module.$member("))
      )
    }
  }
  def arg(call: Call, index: Int) = call.argument.filter(_.argumentIndex == index).l
  def pythonApi(call: Call, module: String, member: String) = api(call, module, member) ||
    (call.name == member && call.methodFullName.startsWith(module.takeWhile(_ != '.') + ".py:") &&
      call.code.startsWith(s"$module.$member("))
  def jsGlobal(call: Call, name: String) = call.name == name && call.code.startsWith(s"$name(") &&
    !call.method.parameter.nameExact(name).nonEmpty && !call.method.local.nameExact(name).nonEmpty &&
    !cpg.method.nameExact(name).isExternal(false).exists(_.fullName == call.methodFullName)
  def typedReceiver(call: Call, suffix: String) = call.argument.filter(_.argumentIndex == 0).exists { receiver =>
    call.method.parameter.exists(p => p.name == receiver.code &&
      (p.typeFullName.matches(s"(?:.*[.:])?$suffix") || p.code.matches(s"(?s).*[: ]${suffix}\\b.*")))
  }

  // These APIs return values without copying arguments into one another or
  // mutating the imported module receiver. Preserve taint to their return value.
  val valueApis = cpg.call.filter { call =>
    if (language == "PYTHONSRC") (
      List("Request", "urlopen").exists(name => pythonApi(call, "urllib.request", name)) ||
      List("dumps", "loads").exists(name => pythonApi(call, "json", name)) ||
      List("quote", "urlencode", "urlsplit", "urlparse").exists(name => pythonApi(call, "urllib.parse", name)) ||
      List("debug", "info", "warning", "error", "exception").exists(name => pythonApi(call, "logging", name)))
    else jsGlobal(call, "fetch") || call.code.matches("(?s)(?:JSON\\.(?:parse|stringify)|console\\.(?:log|info|warn|error|debug))\\(.*") ||
      List("readFile", "readFileSync", "writeFile", "writeFileSync", "stat", "createReadStream").exists(name =>
        api(call, "fs", name) || api(call, "fs/promises", name)) ||
      List("resolve", "join", "normalize", "basename").exists(name => api(call, "path", name))
  }.methodFullName.toList.distinct
  // The frontend leaves @/ imports unresolved. A source-matched function declaration
  // without authored `this` cannot mutate its synthetic call-site receiver. Keep
  // conservative argument-to-argument and argument-to-return flows, including
  // real object mutations; do not apply this to unknown helpers or arrow methods.
  val readOnlyAliasReceivers = if (language != "JSSRC") Nil else {
    val declarations = cpg.method.isExternal(false).filter(m =>
      m.code.matches("(?s)\\s*(?:async\\s+)?function\\b.*") && !m.code.matches("(?s).*\\bthis\\b.*")).l
    cpg.call.filter(_.methodFullName.startsWith("@/")).l.groupBy(_.methodFullName).toList.flatMap { case (name, calls) =>
      val parts = name.stripPrefix("@/").split(":", 2)
      val targets = if (parts.length != 2) Nil else declarations.filter(m => m.name == parts(1) &&
        file(m).replace('\\', '/').replaceAll("\\.(?:tsx?|jsx?|mjs|cjs)$", "") == s"src/${parts(0)}")
      if (targets.size != 1) Nil else {
        val arity = calls.flatMap(_.argument.argumentIndex.l).filter(_ > 0).maxOption.getOrElse(0)
        val mappings = List((0, 0)) ++ (for (input <- 1 to arity; output <- -1 :: (1 to arity).toList) yield (input, output)).toList
        List(FlowSemantic.from(name, mappings))
      }
    }
  }
  val semantics = DefaultSemantics().plus(valueApis.map(name =>
    FlowSemantic(name, List(PassThroughMapping) ++ FlowSemantic.from(name, List((0, 0))).mappings)) ++ readOnlyAliasReceivers)
  semantics.initialize(cpg)
  given EngineContext = EngineContext(semantics = semantics)
  new OssDataFlow(new OssDataFlowOptions(semantics = semantics)).run(new LayerCreatorContext(cpg))

  val otherSinks = cpg.call.l.flatMap { call =>
    val sinks = scala.collection.mutable.ListBuffer.empty[(String, Call, Expression)]
    def sink(rule: String, values: List[Expression]) = values.foreach(value => sinks += ((rule, call, value)))
    if (language == "JSSRC") {
      if (jsGlobal(call, "fetch") || api(call, "undici", "fetch") ||
          List("get", "request").exists(name => api(call, "http", name) || api(call, "https", name)))
        sink("ssrf", arg(call, 1))
      if ((Set("$queryRawUnsafe", "$executeRawUnsafe").contains(call.name) &&
          (typedReceiver(call, "PrismaClient") || cpg.imports.exists(i => file(i) == file(call) &&
            i.importedEntity.exists(_.contains("lib/db:prisma"))))) ||
          (call.name == "query" && (typedReceiver(call, "Pool") || typedReceiver(call, "Client")) &&
            cpg.imports.exists(i => file(i) == file(call) && i.importedEntity.exists(_.startsWith("pg:")))))
        sink("sql-injection", arg(call, 1))
      if (List("readFile", "readFileSync", "writeFile", "writeFileSync", "appendFile", "unlink", "stat", "createReadStream", "createWriteStream").exists(name =>
          api(call, "fs", name) || api(call, "fs/promises", name))) sink("path-traversal", arg(call, 1))
      if (api(call, "next/navigation", "redirect") || (call.name == "redirect" && cpg.imports.exists(i => file(i) == file(call) &&
          i.importedEntity.contains("next/server:NextResponse") && i.importedAs.exists(alias => call.code.startsWith(s"$alias.redirect(")))))
        sink("open-redirect", arg(call, 1))
      if (jsGlobal(call, "eval")) sink("code-injection", arg(call, 1))
      if (call.methodFullName == "__ecma.Function:<init>" || (call.name == "Function" && call.code.startsWith("new Function(")))
        sink("code-injection", call.argument.filter(_.argumentIndex >= 1).l.sortBy(_.argumentIndex).lastOption.toList)
      if (List("merge", "mergeWith", "defaultsDeep", "set").exists(name => api(call, "lodash", name)))
        sink("prototype-pollution", if (call.name == "set") arg(call, 2) else call.argument.filter(_.argumentIndex >= 2).l)
    } else {
      if (pythonApi(call, "urllib.request", "Request") || pythonApi(call, "urllib.request", "urlopen") ||
          List("get", "post", "put", "delete", "patch", "head").exists(name => pythonApi(call, "requests", name) || pythonApi(call, "httpx", name)))
        sink("ssrf", arg(call, 1))
      if (Set("execute", "executemany").contains(call.name) && (typedReceiver(call, "Cursor") || typedReceiver(call, "Connection") ||
          (cpg.imports.exists(i => file(i) == file(call) && i.importedEntity.exists(_.startsWith("psycopg"))) &&
            call.argument.filter(_.argumentIndex == 0).exists(_.code.matches("(?:cursor|pg_cursor|conn|connection)")))))
        sink("sql-injection", arg(call, 1))
      if ((call.name == "open" && call.methodFullName.startsWith("__builtin")) ||
          List("remove", "unlink", "mkdir").exists(name => pythonApi(call, "os", name)) ||
          List("copy", "copyfile", "move").exists(name => pythonApi(call, "shutil", name))) sink("path-traversal", arg(call, 1))
      if (pythonApi(call, "flask", "redirect") || pythonApi(call, "django.shortcuts", "redirect")) sink("open-redirect", arg(call, 1))
      if (Set("eval", "exec").contains(call.name) && call.methodFullName.startsWith("__builtin")) sink("code-injection", arg(call, 1))
      if (List("pickle", "marshal").exists(module => List("load", "loads").exists(name => pythonApi(call, module, name))) ||
          List("load", "unsafe_load", "load_all").exists(name => pythonApi(call, "yaml", name))) {
        // Explicit SafeLoader is safe; a helper merely called sanitize is not a barrier.
        if (!call.argument.exists(a => a.argumentName.contains("Loader") && a.code.matches("(?:yaml\\.)?SafeLoader")))
          sink("unsafe-deserialization", arg(call, 1))
      }
    }
    sinks.toList
  }

  // Confidential values are a different source class from arbitrary request input.
  val secretSources = cpg.call.filter { call =>
    (Set("<operator>.fieldAccess", "<operator>.indexAccess").contains(call.name) &&
      call.code.matches("(?is).*(?:[.\\[\"'])(?:password|passwd|secret|client_secret|clientSecret|access_token|accessToken|refresh_token|refreshToken|authorization|api_key|apiKey|\\w+_(?:SECRET|TOKEN|PASSWORD|KEY))(?:[\"'\\]].*)?")) ||
      (Set("get", "getenv").contains(call.name) && call.argument.exists(a =>
        a.code.matches("(?i)[\"'](?:authorization|password|access_token|secret|.*_SECRET|.*_TOKEN|.*_PASSWORD)[\"']")))
  }.l
  val logSinks = cpg.call.filter { call =>
    if (language == "JSSRC") call.code.matches("(?s)console\\.(?:log|info|warn|error|debug)\\(.*")
    else Set("debug", "info", "warning", "error", "exception", "critical").contains(call.name) &&
      (pythonApi(call, "logging", call.name) || typedReceiver(call, "Logger"))
  }.l.flatMap(call => call.argument.filter(_.argumentIndex >= 1).l.map(a => ("sensitive-logging", call, a)))

  // Full-destination SSRF only. A fixed literal authority cannot become an
  // arbitrary host through its path/query; URL-path authorization is separate.
  def fixedOrigin(value: Expression, depth: Int = 0): Boolean = {
    val code = value.code.trim
    val literal = "(?s)^[fF]?[\"'`]https?://[^/\"'`{}$?#@]+[/?#].*"
    val prefix = "(?s)^[fF]?[\"'`]\\$?\\{([A-Za-z_]\\w*)\\}.*".r
    val firstPart = value match {
      case call: Call if Set("<operator>.formatString", "<operator>.addition", "<operator>.formattedValue", "<operator>.formatValue").contains(call.name) =>
        call.argument.filter(_.argumentIndex >= 1).l.sortBy(_.argumentIndex).find(a => !Set("\"\"", "''", "``").contains(a.code))
      case _ => None
    }
    if (code.matches(literal)) true
    else if (depth >= 6) false
    else if (firstPart.nonEmpty) fixedOrigin(firstPart.get, depth + 1)
    else {
      val name = code match {
        case prefix(variable) => Some(variable)
        case variable if variable.matches("[A-Za-z_]\\w*") => Some(variable)
        case _ => None
      }
      name.exists { variable =>
        val bindings = cpg.call.filter(_.name.startsWith("<operator>.assignment")).filter(a => file(a) == file(value) &&
          (a.method.id == value.method.id || Set("<module>", "<program>", ":program").contains(a.method.name)) &&
          a.argument.exists(n => n.argumentIndex == 1 && n.code == variable)).l
        !value.method.parameter.nameExact(variable).nonEmpty && bindings.size == 1 && bindings.head.name == "<operator>.assignment" &&
          bindings.head.argument.filter(_.argumentIndex == 2).exists(rhs => fixedOrigin(rhs, depth + 1))
      }
    }
  }

  val processCalls = cpg.call.filter { call =>
    if (language == "JSSRC")
      call.methodFullName.matches("(?:node:)?child_process:(?:exec|execSync|execFile|execFileSync|spawn|spawnSync|fork)")
    else
      call.methodFullName.matches("subprocess\\.py:<module>\\.(?:Popen|call|check_call|check_output|run|getoutput|getstatusoutput)")
  }.l

  def commandArguments(call: Call): List[Expression] = {
    if (language == "JSSRC") call.argument.filter(_.argumentIndex == 1).l
    else {
      val executable = call.argument.filter(_.argumentName.contains("executable")).l
      val args = call.argument.filter(arg => arg.argumentName.contains("args") || arg.argumentIndex == 1).l
      val shellEnabled = call.argument.exists(arg => arg.argumentName.contains("shell") && arg.code == "True")
      // Mirrors CodeQL Stdlib: executable override is a sink; a literal sequence
      // contributes its first element, not all ordinary arguments. Dynamic lists
      // remain coarse sinks, like the source model's fallback.
      val commands = if (executable.nonEmpty && !shellEnabled) Nil else args.flatMap { arg =>
        if (arg.code.startsWith("[") || arg.code.startsWith("(")) arg.iterator.isCall.argument(1).l
        else List(arg)
      }
      executable ++ commands
    }
  }

  val candidates = processCalls.flatMap(call => commandArguments(call).map(arg => (call, arg)))
  val allSinks = candidates.map { case (call, argument) => ("command-line-injection", call, argument) } ++ otherSinks ++ logSinks
  val findings = allSinks.filterNot { case (rule, _, argument) => rule == "ssrf" && fixedOrigin(argument) }.flatMap { case (rule, call, argument) =>
    val relevantSources = if (rule == "sensitive-logging") secretSources else sources
    argument.iterator.reachableByFlows(relevantSources.iterator).l.filterNot { flow =>
      // Request construction already checks its URL. Its body/header data must
      // not become a URL sink again through the Request object's return value.
      rule == "ssrf" && language == "PYTHONSRC" && call.name == "urlopen" &&
        flow.elements.exists {
          case request: Call => pythonApi(request, "urllib.request", "Request")
          case _ => false
        }
    }.map { flow =>
      ujson.Obj("ruleId" -> s"${if (language == "JSSRC") "js" else "py"}/$rule",
        "sourceModel" -> (if (rule == "sensitive-logging") "secret.named-value" else sourceKinds.getOrElse(flow.elements.head.id, "unknown")),
        "sink" -> location(call), "commandArgument" -> location(argument),
        "path" -> ujson.Arr.from(flow.elements.map(location)))
    }
  }.groupBy(finding => finding("ruleId").str + ujson.write(finding("sink")) + ujson.write(finding("path")(0))).values.map(_.head).toList
  val result = ujson.Obj("language" -> language, "scope" -> "bounded security flows inspired by CodeQL",
    "files" -> ujson.Arr.from(cpg.file.name.l.sorted),
    "methods" -> cpg.method.isExternal(false).size,
    "calls" -> cpg.call.size,
    "sources" -> ujson.Arr.from(modeledSources.map { case (node, kind) =>
      val loc = location(node); loc("model") = ujson.Str(kind); loc
    }),
    "processCalls" -> ujson.Arr.from(processCalls.map(location)),
    "commandArguments" -> ujson.Arr.from(candidates.map(pair => location(pair._2))),
    "securitySinks" -> ujson.Arr.from((otherSinks ++ logSinks).map { case (rule, call, argument) =>
      val loc = location(call); loc("rule") = ujson.Str(rule); loc
    }),
    "secretSources" -> ujson.Arr.from(secretSources.map(location)),
    "findings" -> ujson.Arr.from(findings))
  java.nio.file.Files.writeString(java.nio.file.Path.of(outFile), ujson.write(result, indent = 2))
}
