class VirtualFile

  attr_accessor :version

  def initialize
    @lines = Array.new
    @version = 0
  end

  def insertLine(l)
    @lines << l
  end

  def each_line
    @lines.each do |l|
      yield l
    end
  end

  def apply_delta(delta)
    case delta["action"]
    when "insertLines"
      insertLines(delta["range"]["start"]["row"], delta["lines"])
    when "insertText"
      insert(delta["range"]["start"], delta["text"])
    when "removeLines"
      removeLines(delta["range"]["start"]["row"], delta["range"]["end"]["row"])
    when "removeText"
      remove(delta["range"])
    end
    @version += 1
  end

  def insertLines(row, lines)
    return if lines.length == 0
    lines.each do |l|
      @lines.insert(row, l + "\n")
      row += 1
    end
  end

  def insert(pos, text)
    return if text.length == 0
    cur_line = pos["row"]
    cur_col = pos["column"]
    while @lines.length-1 < pos["row"]
      @lines <<  ""
    end
    text.each_char do |c|
      if c == "\n"
        # This got pretty messy, but there are a lot of corner cases
        rest = @lines[cur_line][cur_col..-1]
        @lines.insert(cur_line+1, rest)
        if cur_col > 0
          @lines[cur_line] = @lines[cur_line][0..cur_col-1]+"\n"
        else
          @lines[cur_line] = "\n"
        end
        cur_line += 1
        cur_col = 0
      else
        @lines[cur_line].insert(cur_col, c)
        cur_col += 1
      end
    end
  end

  def removeLines(firstRow, lastRow)
    @lines = @lines[0..firstRow][0..-2] + @lines[lastRow..-1]
  end

  def remove(range)
    firstRow = range["start"]["row"]
    lastRow = range["end"]["row"]
    num_rows = lastRow - firstRow
    while @lines.length-1 < lastRow
      @lines << ""
    end
    if num_rows >= 1
      lr = @lines[lastRow]
      @lines[lastRow] = lr[range["end"]["column"]..-1]
      removeLines(firstRow+1, lastRow-1) if num_rows >= 2
      @lines[firstRow] = @lines[firstRow][0..range["start"]["column"]][0..-2]
      # Merge lines if \n was deleted
      if @lines[firstRow][-1] != "\n"
        @lines[firstRow] += @lines[lastRow]
        @lines.delete_at(lastRow)
      end
    else
      fr = @lines[firstRow]
      @lines[firstRow]=fr[0..range["start"]["column"]][0..-2]+fr[range["end"]["column"]..-1]
    end
  end
end
